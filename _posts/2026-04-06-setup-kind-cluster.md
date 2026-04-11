---
title: Spring REST 2 - Deploying the Spring REST Demo in KIND using Gateway API
layout: post
header-img: "img/kubernetes.png"
---

KinD (Kubernetes in Docker) is a ...

[`cloud-provider-kind`](https://github.com/kubernetes-sigs/cloud-provider-kind)

## Install

```shell
go install sigs.k8s.io/kind@v0.31.0
```

Cloud-provider-kind is ....

It can be installed using go:

```shell
go install sigs.k8s.io/cloud-provider-kind@latest
```

On my local Linux system this installs the binary in $GOBIN (usually ~/go/bin). We can make it available everywhere by installing it into `/usr/local/bin`:

```shell
sudo install ~/go/bin/cloud-provider-kind /usr/local/bin
```

## Run

To be compatible with `cloud-provider-kind` we will need to run a node image version of 1.33 or above: 

```shell
kind create cluster --image kindest/node:v1.33.4
```

The GitHub docs suggest we need to remove a label from the single kind node, `kind-control-plane`, to allow ingress access to the control plane, which is forbidden in the default single node setup (though in my setup the `kind-control-plane` node did not have this label):

```shell
kubectl label node kind-control-plane node.kubernetes.io/exclude-from-external-load-balancers-
```

`cloud-provider-kind` runs as a separate application, so we do this in a new window:

```shell
cloud-provider-kind
```

Its important that your cluster is up and running when you do this step as it adds some CRDs to the cluster. Its also important that you keep this running throughout the process! This caught me out once or twice.

There should now be an additional CRD in the cluster:

```shell
tw:~/Code/spring-boot-kubernetes$ kubectl get crd
NAME                                           CREATED AT
backendtlspolicies.gateway.networking.k8s.io   2026-04-11T20:41:16Z
gatewayclasses.gateway.networking.k8s.io       2026-04-11T20:41:16Z
gateways.gateway.networking.k8s.io             2026-04-11T20:41:16Z
grpcroutes.gateway.networking.k8s.io           2026-04-11T20:41:16Z
httproutes.gateway.networking.k8s.io           2026-04-11T20:41:16Z
referencegrants.gateway.networking.k8s.io      2026-04-11T20:41:16Z
```

There is still no actual Gateways yet though. So we need a Gateway manifest:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: gateway
  namespace: gateway
spec:
  gatewayClassName: cloud-provider-kind
  listeners:
    - name: default
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: All
```

Which we apply like so:

```shell
kubectl apply -f gateway.yaml
```

With any luck, we should soon have a Gateway with an IP address we can use to access the cluster:

```shell
tw:~/Code/spring-boot-kubernetes$ kubectl get gateway -A
NAMESPACE   NAME      CLASS                 ADDRESS      PROGRAMMED   AGE
gateway     gateway   cloud-provider-kind   172.18.0.3   True         114s

```

If not, check the `cloud-provider-kind` logs for errors.

In AWS this would create a ...

## Deploy application

Once this is all setup we are ready to deploy an actual application. In order to work with the Gateway API we need to have a `HTTPRoute` to connect the `Gateway` with the application `Service`. Here is what the `HTTPRoute` looks like:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: spring-boot-app
spec:
  parentRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: gateway
      namespace: gateway
  rules:
    - backendRefs:
        - group: ""
          kind: Service
          name: spring-boot-app
          port: 80
      matches:
        - path:
            type: PathPrefix
            value: /
```

You can install the Helm charts from the [`tony-waters/spring-boot-kubernetes`](https://github.com/tony-waters/spring-boot-kubernetes) repo:

```shell
git clone https://github.com/tony-waters/spring-boot-kubernetes.git
helm install spring-boot-app ./helm/spring-boot-app/
```

## Test it works

Is the application healthy:

```shell
curl http://172.18.0.3:80/actuator/health/liveness
```

Can we issue queries on the api:

```shell
curl http://172.18.0.3:80/api/customers
```

Lets run some tests:

```shell
BASE_URL=http://172.18.0.3:80 k6 run ./k6/customer-behabiour-write-test.j
```


## Notes

## Resources

[cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind)
[Experimenting with Gateway API using kind](https://kubernetes.io/blog/2026/01/28/experimenting-gateway-api-with-kind/)




