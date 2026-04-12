---
title: Spring REST 2 - Deploying the Spring REST Demo in KIND using Gateway API
layout: post
header-img: "img/kubernetes.png"
---

Lets deploy the [Demo Spring Boot application](https://github.com/tony-waters/spring-boot-app) into Kubernetes using [`kind`](https://kind.sigs.k8s.io/) as the cluster and [`cloud-provider-kind`](https://github.com/kubernetes-sigs/cloud-provider-kind) to provide HTTP access to the cluster. 

Once installed, we will need some additional files which live in [`tony-waters/spring-boot-kubernetes`](https://github.com/tony-waters/spring-boot-kubernetes):

```shell
git clone https://github.com/tony-waters/spring-boot-kubernetes.git
```

## Installation

Both `kind` and `cloud-provider-kind` can be installed using golang. To install `kind`:

```shell
go install sigs.k8s.io/kind@v0.31.0
```

for `cloud-provider-kind`:

```shell
go install sigs.k8s.io/cloud-provider-kind@latest
```

On my local Linux system this installs the `cloud-provider-kind` binary in $GOBIN (usually ~/go/bin). We can make it available everywhere by installing it into `/usr/local/bin`:

```shell
sudo install ~/go/bin/cloud-provider-kind /usr/local/bin
```

## Running the cluster

To be compatible with `cloud-provider-kind` we need to run a `kind` node image with version 1.33 or above: 

```shell
kind create cluster --image kindest/node:v1.33.4
```

The GitHub docs suggest we need to remove a label from the single kind node, `kind-control-plane`, to allow ingress access to the control plane, which is forbidden in the default single node setup (though in my setup the `kind-control-plane` node did not have this label):

```shell
kubectl label node kind-control-plane node.kubernetes.io/exclude-from-external-load-balancers-
```

Before running `cloud-provider-kind` note there are no Custom Resource Definitions in the cluster:

```shell
tw:~/Code/spring-boot-kubernetes$ kubectl get crd
No resources found
```

Then run `cloud-provider-kind` as a separate application, so we do this in a new window:

```shell
cloud-provider-kind
```

The cluster must be up and running when you do this step as it adds some CRDs to the cluster. Its also important that you keep this running throughout the process! This caught me out once or twice.

There should now be some CRDs in the cluster:

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

There is still no actual Gateway yet though. The manifest should look something like this:

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

If you cloned the previously mentioned repo, you can apply this manifest like so:

```shell
kubectl apply -f gateway.yaml
```

With any luck, we should soon have a Gateway with an IP address we can use to access the cluster:

```shell
tw:~/Code/spring-boot-kubernetes$ kubectl get gateway -A
NAMESPACE   NAME      CLASS                 ADDRESS      PROGRAMMED   AGE
gateway     gateway   cloud-provider-kind   **172.18.0.3**   True         114s
```

If not, check the `cloud-provider-kind` logs for errors.

## Deploy the application

Once this is all setup we are ready to deploy an actual application. In order to work with the Kubernetes [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/) we need to have a `HTTPRoute` to connect the `Gateway` with the application `Service`. Here is what the `HTTPRoute` looks like:

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

You can find the Helm charts in the [`tony-waters/spring-boot-kubernetes`](https://github.com/tony-waters/spring-boot-kubernetes/tree/main/helm) repo. I install them using Terraform:

```shell
cd terraform && terraform apply -var-file=terraform.tfvars.example
```

## Test it works

Using the IP address from the `Gateway`, we can check if the application is healthy:

```shell
curl http://172.18.0.3:80/actuator/health/liveness
```

Issue queries on the REST API:

```shell
curl http://172.18.0.3:80/api/customers
```

And run some integration/load tests (from the `k6` folder):

```shell
BASE_URL=http://172.18.0.3:80 k6 run ./k6/customer-behabiour-write-test.js
```

If you want to throw some seed data into the mix to make the tests more realistic, you can first run the seeder as a Helm job inside the cluster. This will create 5,000 customers with related data:

```shell
cd seed && ./run-seed.sh
```

## Conclusion

Thats it! We now have the Spring Demo application running in a kubernetes `kind` cluster and accessible via the Gateway API using `cloud-provider-kind`.
All that is left to do is clean up:

```shell
kind delete cluster
```

## Resources

[cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind)
[Experimenting with Gateway API using kind](https://kubernetes.io/blog/2026/01/28/experimenting-gateway-api-with-kind/)
[Kubernetes Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)
[Kubernetes Gateway API in 2026: The Definitive Guide to Envoy Gateway, Istio, Cilium and Kong](https://dev.to/mechcloud_academy/kubernetes-gateway-api-in-2026-the-definitive-guide-to-envoy-gateway-istio-cilium-and-kong-2bkl)




