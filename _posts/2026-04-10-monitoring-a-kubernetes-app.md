---
title: Spring REST 3 - Observing the Spring Demo application in Kubernetes
layout: post
header-img: "img/spring5.jpg"
---

Particularly in the early stages of an application development lifecycle, it can be useful to see visual representations of what is going on. In the real world this repository would likely not exist as a single thing - Helm, Terraform, load testing. For demo and local development purposes having these things in one place allows us to discover some useful things locally, which would otherwise be discovered downstream.

There are different things to observe:

- pod state
- traffic
- logs
- database contents
- stress test behaviour

Some tools I like to use are:

- Istio (network charts)
- Prometheus
- Logging

## Objectives

Lets take the sample application and put it into a local kubernetes environment - then run some tests and observe what happens. This will give us some confidence as it moves through downstream testing, as well as providing insight into and highlighting issues before it hits them.

We will use the Demo Rest App docker image, created using the apps [GitHubAction]() and located [here]().

## The Helm setup in the repo

We use Helm to do the heavy work in taking an image and creating a pod and the pods needs. Here are the Helm charts we want to include:

- prometheus
- istio
- pgadmin


## The Terraform setup in the repo

We will use Terraform to orchestrate the process of creating the 'infrastructure' (*) kere:

## Running it all

## Experimenting with the Observations

[important]

---







## The Terraformed and Helmed application




## install prometheus community stack

helm install prom1 oci://ghcr.io/prometheus-community/charts/kube-prometheus-stac

## make it work with ingress in kind

https://kind.sigs.k8s.io/docs/user/ingress/

