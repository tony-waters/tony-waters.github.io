---
title: Running Ansible jobs for non-developers with Docker, Jenkins, and Nginx
layout: post
---

Ansible jobs sometimes need to be run by non-developers, or someone unfamiliar with the command line.
To facilitate this we need a way of running Ansible using a GUI, and possibly a way of reporting the result of the jobs.
A pattern I have used several times uses Jenkins as a front end for running Ansible, and using Nginx to report on the result of these jobs to a wider audience.
In this blog I want to go over how we can achieve this.

Full code is available [here].

##The Ansible job
To keep things simple, this job just ping's a list of servers/VMs defined in 'group_vars':

{% highlight html linenos %}
{% raw %}
servers:
    - { server: 'server1', domain: '127.0.0.1' }
    - { server: 'server2', domain: 'google.com' }
{% endraw %}
{% endhighlight %}

We loop through the servers list, creating JSON document fragments for each of the responses:

{% highlight html linenos %}
{% raw %}
- include: check.yml check_item="{{ item }}"
  with_items: "{{ servers }}"

- name: report fully
  template:
    src: pingchecks.json
    dest: "{{ role_path }}/json/pingchecks.json"
{% endraw %}
{% endhighlight %}

Storing the final document in '{{ role_path }}/json/pingchecks.json'.
Then create a JSON document showing the results using jinja2:

{% highlight html linenos %}
{% raw %}
{
  "last-updated": "{{ '%s %s:%s'|format(ansible_date_time.date, ansible_date_time.hour, ansible_date_time.minute) }}",
  "pingchecks": {
    "localhost": [{% include 'roles/ping/json/ping-server1.json' %}],
    "google": [{% include 'roles/ping/json/ping-server2.json' %}]
  }
}
{% endraw %}
{% endhighlight %}

This job can be anything. In this case I've included a reporting element (the JSON document) to showcase how we can integrate Nginx.

The Dockerfile looks like this:

{% highlight html linenos %}
{% raw %}
FROM centos:7

RUN yum install -y epel-release ansible

WORKDIR /root

COPY roles /root/roles
COPY group_vars /root/group_vars

COPY inventory.ini .
COPY ansible.cfg .
COPY ping.yml .

ENTRYPOINT ["ansible-playbook"]
CMD ["ping.yml"]
{% endraw %}
{% endhighlight %}


##Jenkins
We will use Jenkins as a GUI for those unfamiliar with the command line.
We will the 'ready-made' Jenkins I created previously - 'bit1/insta-jenkins' (code here).
And set the 'jobs.groovy' file to contain a job that runs the Ansible ping check.

{% highlight html linenos %}
{% raw %}
pipelineJob('pingchecks') {
    definition {
        triggers {
            cron('*/2 * * * *')
        }
        cps {
            concurrentBuild(false)
            sandbox()
            script("""
                node {
                  stage('Run Pingchecks') {
                        sh '''
                            docker run --rm -v app-data:/root/roles/pingcheck/json ansible_controller ping.yml
                        '''
                  }
                }
              """.stripIndent()
            )
        }
    }
}
{% endraw %}
{% endhighlight %}

You may notice that I've set this job to automatically run every 2 minutes. Make this a manual job if it suits. Any number of jobs can be added here.

##Nginx
The final component is Nginx. We want Nginx to serve the JSON files created by the Ansible ping checks.
I've gone for the most basic Nginx Docker image.

##Putting it all together
I'm using docker-compose to avoid long docker build / run comands.
We want the JSON documents produced by Ansible to be available to Nginx.
This is done using a named volume ('app-data').

Here is the full docker-compose.yml file:

{% highlight html linenos %}
{% raw %}
version: '2'
services:

  ansible_controller:
    container_name: ansible_controller
    build:
      context: ansible/.
      args:
        - http_proxy
        - https_proxy
    volumes:
      - app-data:/root/roles/ping/json

  ansible_controller_dashboard:
    container_name: ansible_controller_dashboard
    image: nginx
    ports:
      - "80:80"
    volumes:
      - app-data:/usr/share/nginx/html/json

  ansible_controller_jenkins:
    container_name: ansible_controller_jenkins
    build:
      context: jenkins/.
      args:
        - http_proxy
        - https_proxy
    ports:
      - 9999:8080
      - 50000:50000
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    privileged: true

volumes:
  app-data:
  jenkins-data:
{% endraw %}
{% endhighlight %}

And there we have it.
Anyone familiar with Jenkins can now run Ansible jobs, and view their results.
