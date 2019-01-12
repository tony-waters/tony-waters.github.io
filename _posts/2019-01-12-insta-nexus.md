---
title: Automating repository creation in SonaType Nexus 3
layout: post
---

Getting [Nexus](https://www.sonatype.com/nexus-repository-sonatype)
up and runnign using its Docker image is a breeze, but provides only the default repositories.
To make Nexus immediately useful we need to include repository creation as part of the setup process.

In the spirit of automation, I want to demonstrate how we make Nexus instantly useful by also provisioning our own repositories.

## Run Nexus

We will be needing a vanilla install of Nexus 3 to add some repos to.
Let's do that with Docker:

> docker run -d -p 8081:8081 --name nexus sonatype/nexus3

We must also give Nexus some time to start up before any requests can be properly handled.
Manually following the logs is one option, but bash can help us automate the process:

>  ( docker logs -f nexus & ) | grep -q "Started Sonatype Nexus*"

## Creating Repositories in Nexus 3

While we're waiting for nexus to start, let's understand the process of repository creation.
Nexus has various Restful APIs that provide everything you need for its day-to-day usage.
https://help.sonatype.com/repomanager3/rest-and-integration-api
You could spend some time reading the documentation before realising nothing is in these APIs on creating new repos.
This is where the 'scripts' API comes in.
https://help.sonatype.com/repomanager3/rest-and-integration-api/script-api

According to the documentation, th scripts API "provides methods to simplify provisioning and executing other complex tasks in the repository manager".

Its slightly conveluted, but if you want to create a new repo,
you need to write a groovy script to do it,
then publish this script to Nexus,
then tell nexus to run it.
And oh, did I mention, the groovy script needs to be nested within a Json document.

Once youve done it once, its easy. So lets save you some stress, and walk through the process.

## Creating Nexus 3 repos using JSON and the Nexus Groovy DSL

Having to nest our script in Json is not so bad for small scripts - and luckily the DSL in groovy is quite kurt:

<pre>
{
  "name": "create_maven_releases_repo",
  "type": "groovy",
  "content": "repository.createMavenHosted('releases', 'default', true, org.sonatype.nexus.repository.maven.VersionPolicy.RELEASE, org.sonatype.nexus.repository.storage.WritePolicy.ALLOW, org.sonatype.nexus.repository.maven.LayoutPolicy.STRICT)"
}
</pre>

We put the name of the JSON file (without the extension) as the 'name'.
The Groovy script goes into the 'content' value.
If you are from a Java background, just think of this as a pre-prepared instance variable ('repository') that you can call methods on.
Let's see an example of a JSON file containing groovy DSL that creates a maven 'releases' repo.


Don't bother checking the Nexus site for a list of repository creation method signatures.
The recommendation is that you use code completion (in IntelliJ for example) as documentation.
Instructions on how to do this is provided.
Its a little fiddly, but workable if your familiar with IntelliJ.

If we POST this JSON file to Nexus, we can create a repo.
We will use the default 'admin/admin123' username/password combo.
The Docker Nexus container should now be available - on my system its at 192.169.99.101:

> curl -v -X POST -u "admin:admin123" --header "Content-Type: application/json" "http://192.168.99.101:8081/service/rest/v1/script" -d @create_maven_releases_repo.json

If ll goes well, you should get something like the following:

<pre>
* About to connect() to 192.168.99.101 port 8081 (#0)
*   Trying 192.168.99.101...
* Connected to 192.168.99.101 (192.168.99.101) port 8081 (#0)
* Server auth using Basic with user 'admin'
> POST /service/rest/v1/script HTTP/1.1
> Authorization: Basic YWRtaW46YWRtaW4xMjM=
> User-Agent: curl/7.29.0
> Host: 192.168.99.101:8081
> Accept: */*
> Content-Type: application/json
> Content-Length: 305
>
* upload completely sent off: 305 out of 305 bytes
< HTTP/1.1 204 No Content
< Date: Fri, 11 Jan 2019 23:05:42 GMT
< Server: Nexus/3.14.0-04 (OSS)
< X-Content-Type-Options: nosniff
<
</pre>

Don't bother checking the Nexus GUI yet, all we've done so far is 'publish' the Groovy script.
We still need to run it.
You can check its there ready to run if you like:

> curl -v -X GET -u "admin:admin123" "http://192.168.99.101:8081/service/rest/v1/script"

Your output should look something like this:

<pre>
< HTTP/1.1 200 OK
< Date: Fri, 11 Jan 2019 23:05:42 GMT
< Server: Nexus/3.14.0-04 (OSS)
< X-Content-Type-Options: nosniff
< Content-Type: application/json
< Content-Length: 949
<
[ {
  "name" : "create_maven_releases_repo",
  "content" : "repository.createMavenHosted('releases', 'default', true, org.sonatype.nexus.repository.maven.VersionPolicy.RELEASE, org.sonatype.nexus.repository.storage.WritePolicy.ALLOW, org.sonatype.nexus.repository.maven.LayoutPolicy.STRICT)",
  "type" : "groovy"
},
</pre>

So far so good.
Before we run the script, let's see which repos we have in the default install.
Here's a screenshot:


Run the script:

> curl -X POST -u "admin:admin123" --header "Content-Type: text/plain" "http://192.168.99.101:8081/service/rest/v1/script/create_maven_releases_repo/run"

If all goes well, you should now see the new 'releases' repo in the Nexus GUI:

## Conclusion

That's basically it.
I've included JSON to create maven hosted repos, maven group repos, and RPM repos in the example at ...

If you run the 'go.sh' script in a Docker enabld Linux environment it will create snapshot, release, and RPM repos.
It will also create a group repo containing these other repos, and the Maven central repos.
Edit as you see fit.











