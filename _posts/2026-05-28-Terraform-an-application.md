---
title: Spring REST 3 - Using Terraform for a local Development environment
layout: post
header-img: "img/spring5.jpg"
---

[Last post](https://tony-waters.github.io/2026/04/06/setup-kind-cluster-v2.html) I deployed a [demo spring boot application](https://github.com/tony-waters/spring-boot-app) into a Kubernetes `kind` cluster, using Bash scripts to orchestrate the various technologies involved. While it worked, using shell scripts to automate creating and destroying the cluster, infrastructure, and application felt hacky - I wished for a more structured way of orchestrating things.

If only there was something that could allow me to define and provision local infrastructure using declarative configuration files?

I decided to try and create the same demo/development environment using Terraform. Because of the nature of the environment I was able to use Terraform to do things that would not be advisable in less important environments - that's to say don't try this approach with non-trivial Terraform code.

Using Terraform I want to:

1. create a `kind` cluster
2. make Docker run `cloud-provider-kind` for the Gateway
3. have Helm install Postgres, pgadmin, and Prometheus/Grafana
4. deploy and seed the Spring REST application

I ended up creating 3 Terraform installations:

1. cluster/kind
2. infrastructure (Postgres, pgadmin, Prometheus/Grafana)
3. application (the Spring REST demo)

This meant I could use small (and simple) convenience scripts to bring everything up and down, and be able to update parts of the system independently. 

To bring everything up run (from the `terraform` directory):

```shell
terraform -chdir=kind init
terraform -chdir=kind apply -auto-approve
sleep 30

terraform -chdir=infra init
terraform -chdir=infra apply -auto-approve

terraform -chdir=app init
terraform -chdir=app apply -auto-approve
```

This takes about 6 minutes to be ready. You should have these pods running:

```shell
> kubectl get po -A
NAMESPACE            NAME                                                      READY   STATUS      RESTARTS   AGE
application          springapp-6f849fd676-rtmv7                                1/1     Running     0          3m26s
application          springseed-mcz8m                                          0/1     Completed   0          2m13s
kube-system          coredns-7d764666f9-s8fxp                                  1/1     Running     0          6m42s
kube-system          coredns-7d764666f9-sfzpk                                  1/1     Running     0          6m42s
kube-system          etcd-springapp-cluster-control-plane                      1/1     Running     0          6m51s
kube-system          kindnet-msb85                                             1/1     Running     0          6m42s
kube-system          kindnet-prwd9                                             1/1     Running     0          6m42s
kube-system          kube-apiserver-springapp-cluster-control-plane            1/1     Running     0          6m51s
kube-system          kube-controller-manager-springapp-cluster-control-plane   1/1     Running     0          6m50s
kube-system          kube-proxy-9wtv5                                          1/1     Running     0          6m42s
kube-system          kube-proxy-wgplp                                          1/1     Running     0          6m42s
kube-system          kube-scheduler-springapp-cluster-control-plane            1/1     Running     0          6m50s
local-path-storage   local-path-provisioner-67b8995b4b-m8j7m                   1/1     Running     0          6m42s
pgadmin              pgadmin-0                                                 1/1     Running     0          6m17s
postgres             postgres-0                                                1/1     Running     0          6m17s
prometheus           prometheus-grafana-7f84984f7d-kbx26                       3/3     Running     0          5m2s
prometheus           prometheus-kube-prometheus-operator-67f88f78c6-ps5vg      1/1     Running     0          5m2s
prometheus           prometheus-kube-state-metrics-d585bd88d-8g7xl             1/1     Running     0          5m2s
prometheus           prometheus-prometheus-kube-prometheus-prometheus-0        2/2     Running     0          4m50s
prometheus           prometheus-prometheus-node-exporter-7g5mm                 1/1     Running     0          5m2s
prometheus           prometheus-prometheus-node-exporter-m57fv                 1/1     Running     0          5m2s

```

Once it has run, lets do a sanity check that we can reach it and it has been seeded. First we need the IP address of the Gateway:

```shell
> kubectl get gateway -A
NAMESPACE             NAME                  CLASS                 ADDRESS      PROGRAMMED   AGE
application-gateway   application-gateway   cloud-provider-kind   **172.18.0.4**   True         5m17s
```

We can issue a `curl` to check we have access and the database is seeded (the header is used by the `HTTPRoute` to direct traffic to the application):

```shell
curl -H "Host: application" http://172.18.0.4:80/api/customers
```

If all is well, you should see something like this:

```shell
curl -H "Host: application" http://172.18.0.4:80/api/customers
{"content":[{"id":31219,"displayName":"Alice Allen"},{"id":6048,"displayName":"Alice Allen"},{"id":29901,"displayName":"Alice Allen"},{"id":18419,"displayName":"Alice Allen"},{"id":7813,"displayName":"Alice Allen"},{"id":26007,"displayName":"Alice Allen"},{"id":23844,"displayName":"Alice Allen"},{"id":29265,"displayName":"Alice Allen"},{"id":13290,"displayName":"Alice Allen"},{"id":1333,"displayName":"Alice Allen"},{"id":21029,"displayName":"Alice Allen"},{"id":15190,"displayName":"Alice Allen"},{"id":702,"displayName":"Alice Allen"},{"id":18958,"displayName":"Alice Allen"},{"id":6024,"displayName":"Alice Allen"},{"id":9085,"displayName":"Alice Allen"},{"id":20279,"displayName":"Alice Brown"},{"id":15754,"displayName":"Alice Brown"},{"id":16101,"displayName":"Alice Brown"},{"id":3927,"displayName":"Alice Brown"}],"empty":false,"first":true,"last":false,"number":0,"numberOfElements":20,"pageable":{"offset":0,"pageNumber":0,"pageSize":20,"paged":true,"sort":{"empty":false,"sorted":true,"unsorted":false},"unpaged":false},"size":20,"sort":{"empty":false,"sorted":true,"unsorted":false},"totalElements":5000,"totalPages":250}
```

---

## K6 Tests

I have included read and write tests for K6. Run the write test like this:

```shell
k6 run \
  -e TEST_PROFILE=smoke \
  -e BASE_URL=http://172.18.0.4 \
  -e HOST_HEADER=application \
  ./k6/write-test.js
```

Same for the read test:

```shell
k6 run \
  -e TEST_PROFILE=smoke \
  -e BASE_URL=http://172.18.0.4 \
  -e HOST_HEADER=application \
  ./k6/read-test.js
```

You can also run using `TEST_PROFILE=load` and `TEST_PROFILE=stress`.

---

## pgadmin

pagadmin is available at. To login use `user@somewhere.com`/`pgadmin`:

![Image alt]({{ site.baseurl }}/img/pgadmin-login.png "pgadmin login screen")

You will also need to use password `change-me-now` to connect to the database.

![Image alt]({{ site.baseurl }}/img/pgadmin-login.png "pgadmin login screen")

---

## Prometheus and Grafana

Grafana is available at the path `/grafana`. To login use `admin`/`admin`: 

![Image alt]({{ site.baseurl }}/img/grafana-login.png "Grafana login screen")

---

## Conclusion

While using Terraform to create a Development environment involves practices one would not want to use for production, it provides a repeatable and modular approach that can be more easily reasoned over. In many ways the Terraform was quicker to write and get working than the bash scripts - much easier to troubleshoot.

On the other hand, the scripts are a lot faster to run :)

## Resources

- [Terraform kind provider](https://github.com/elioseverojunior/terraform-provider-kind)
- [Prometheus helm chart simplified](https://medium.com/@kedarnath93/high-level-understanding-of-prometheus-helm-chart-c764e720e4ec)
- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/blob/main/charts/kube-prometheus-stack/README.md)
- [Monitor a Spring Boot App Using Prometheus](https://docs.spring.io/spring-boot/api/rest/actuator/prometheus.html)
- [Install pgadmin in kubernetes](https://www.enterprisedb.com/blog/how-deploy-pgadmin-kubernetes)

'


