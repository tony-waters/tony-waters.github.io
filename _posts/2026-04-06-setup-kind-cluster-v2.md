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

## Running the cluster

To be compatible with `cloud-provider-kind` we need to create a cluster using a `kind` node image with version 1.33 or above: 

```shell
kind create cluster --image kindest/node:v1.33.4
```

The [`cloud-provider-kind` GitHub docs](https://github.com/kubernetes-sigs/cloud-provider-kind?tab=readme-ov-file#allowing-load-balancers-access-to-control-plane-nodes) suggest we need to remove a label from the single `kind` node, `kind-control-plane`, to allow ingress access to the control plane, which is forbidden in the default single node setup (though in my setup the `kind-control-plane` node did not have this label):

```shell
kubectl label node kind-control-plane node.kubernetes.io/exclude-from-external-load-balancers-
```

Before running `cloud-provider-kind` note there are no Custom Resource Definitions (CRDs) in the cluster:

```shell
user:~/spring-boot-kubernetes$ kubectl get crd
No resources found
```

To get the `Gateway API` CRDs, and provide access to the cluster. we need `cloud-provider-kind` running as a separate application. There are 2 ways of doing this:

### 1. Running `cloud-provider-kind` from a shell

On my local Linux system `go` installs the `cloud-provider-kind` binary in $GOBIN (usually ~/go/bin). We can (and to make our lives easier, should) make it available more generally by installing it into `/usr/local/bin`:

```shell
sudo install ~/go/bin/cloud-provider-kind /usr/local/bin
```

Then we can run it in a dedicated shell:

```shell
cloud-provider-kind
```

### 2. Running `cloud-provider-kind` from a Docker container

The provider also comes as a Docker image:

```shell
docker run -d \
  --name cloud-provider-kind \
  --rm \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.10.0
```

### Note

Whichever option you use, the cluster must be up and running when you do this step as it adds some CRDs to the cluster. Its also important that you keep this running throughout the process. This caught me out once or twice!

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

## Installing the Spring Demo Application

In order to run the application we need to make the following changes to the cluster:

- create namespaces
- add a Gateway to allow traffic in
- add a Postgres database
- deploy the application

optionally:

- seed data
- run K9 tests

To make things easy to reason over, I have created an over-simplified set of Helm charts for this, keeping `values.yaml` files to a minimum. Install them from the `helm` and `helm-infra` directories. Start by installing the infrastructure . Note that the separate components of `helm-infra` (namespaces, Gateway, and Postgres) are installed using a parent chart.

```shell
helm dependency build ./helm-infra
helm install infra ./helm-infra
```

With any luck, Postgres will soon be running in the cluster. Also, we should soon have a `Gateway` with an IP address we can use to access the cluster:

```shell
tw:~/spring-boot-kubernetes$ kubectl get gateway -A
NAMESPACE   NAME      CLASS                 ADDRESS      PROGRAMMED   AGE
gateway     gateway   cloud-provider-kind   **172.18.0.3**   True         114s
```

If not, check the `cloud-provider-kind` logs for errors.

## Deploy the application

Once this is all setup we are ready to deploy an actual application. In order to work with the Kubernetes [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/) we need to have a `HTTPRoute` to connect the `Gateway` with the application `Service`.

Here is the Gateway from the previous step:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: application-gateway
  namespace: application-gateway
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

Here is what the `HTTPRoute` looks like:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: application
  namespace: application
spec:
  parentRefs:
    - kind: Gateway
      name: application-gateway
      namespace: application-gateway
  hostnames:
    - application
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: spring-boot-app
          port: 80

```

I am asking the Gateway to send any traffic with `Host: application` as a Header to the `spring-boot-app` service on port 80. The `Service` sends this request to the application on port 8080:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: spring-boot-app
  namespace: application
spec:
  type: ClusterIP
  selector:
    app: spring-boot-app
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 8080
```

To deploy the application:

```shell
helm dependency build ./helm/springapp
helm install springapp ./helm/springapp
```

Once everything is up and running, you should have a working HTTPRoute:

```yaml
user:~/spring-boot-kubernetes$ kubectl describe httproute springapp -n application
Name:         springapp
Namespace:    application
Labels:       app.kubernetes.io/managed-by=Helm
Annotations:  meta.helm.sh/release-name: springapp
              meta.helm.sh/release-namespace: default
API Version:  gateway.networking.k8s.io/v1
...
Status:
  Parents:
    Conditions:
      Message:               **Route is accepted.**
      Observed Generation:   1
      Reason:                Accepted
      Status:                True
      Type:                  Accepted
      Last Transition Time:  2026-04-16T18:07:45Z
      Message:               **All references resolved**
      Observed Generation:   1
      Reason:                ResolvedRefs
      Status:                True
      Type:                  ResolvedRefs
...
Events:              <none>

```

Optionally, if you want to throw some seed data into the mix to make tests more realistic run the seeder. This will create 5,000 customers with related data:

```shell
helm dependency build ./helm/springseed
helm install springseed ./helm/springseed
```

You should see this in the logs:

```shell
Seed complete: 5000 customers  
```
## Test it works

Using the IP address from the `Gateway`, we can check if the application is healthy:

```shell
curl -H "Host: application" http://172.18.0.3:80/actuator/health/liveness
```

Issue queries on the REST API:

```shell
curl -H "Host: application" http://172.18.0.3:80/api/customers
```

## Run some K6 tests:

I have included read and write tests for K6. Run the write test like this:

```shell
k6 run \
  -e TEST_PROFILE=smoke \
  -e BASE_URL=http://172.18.0.3 \
  -e HOST_HEADER=application \
  ./k6/write-test.js
```

If thats clean, you can try running using `TEST_PROFILE=load` and `TEST_PROFILE=break`.

Same for the read tests:

```shell
k6 run \
  -e TEST_PROFILE=smoke \
  -e BASE_URL=http://172.18.0.3 \
  -e HOST_HEADER=application \
  ./k6/read-test.js
```

## Conclusion

Thats it! We now have the Spring Demo application running in a kubernetes `kind` cluster and accessible via the Gateway API using `cloud-provider-kind`.
All that is left to do is clean up:

```shell
kind delete cluster
```

## Resources

- [cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind)
- [Experimenting with Gateway API using kind](https://kubernetes.io/blog/2026/01/28/experimenting-gateway-api-with-kind/)
- [Kubernetes Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Kubernetes Gateway API in 2026: The Definitive Guide to Envoy Gateway, Istio, Cilium and Kong](https://dev.to/mechcloud_academy/kubernetes-gateway-api-in-2026-the-definitive-guide-to-envoy-gateway-istio-cilium-and-kong-2bkl)




