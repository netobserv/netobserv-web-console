# NetObserv Web Console

[![Docker Repository on Quay](https://quay.io/repository/netobserv/network-observability-console-plugin/status "Docker Repository on Quay")](https://quay.io/repository/netobserv/network-observability-console-plugin)
[![Go Report Card](https://goreportcard.com/badge/github.com/netobserv/network-observability-console-plugin)](https://goreportcard.com/report/github.com/netobserv/network-observability-console-plugin)

The web console can be deployed either as a standalone console, or as a [console plugin](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk) for OpenShift.

## First setup

You will need Go, Node.js and npm in order to run the `make` commands described below. You can take a look at the [Dockerfile](./Dockerfile) to get known working versions of these tools. In particular, node and npm are known to often break builds if you don't use the expected versions (even patch versions for npm). You can use [nvm](https://github.com/nvm-sh/nvm) to manage installed node / npm versions.

Once these tools are installed, run the following command:

```bash
make install-frontend
```

## Building, linting, testing

To build the plugin, run:

```bash
make build
```

To run tests and linter:

```bash
make test lint
```

These targets will build / lint / test both the backend and the frontend. They have selective equivalent to build/lint/test only the backend or the frontend (e.g. `make build-frontend`).

There are also convenient targets to build+lint+test the backend or the frontend:

```bash
make frontend
make backend
```

For faster frontend builds, you can set the variable: `BUILDSCRIPT=:dev`. E.g:

```bash
BUILDSCRIPT=:dev make frontend
```

It will skip optimizations for production.

## Development environment

### Standalone console

To build a standalone frontend (ie. not tied to the OpenShift Console as a plugin), run these steps:

```bash
# build and push on your own quay.io account (quay.io/myuser/network-observability-standalone-frontend:dev):
STANDALONE=true IMAGE_ORG=myuser VERSION=dev make images
```

If you have a running cluster with NetObserv and Loki installed, you can serve the standalone frontend using a port-forwarded Loki:

```bash
kubectl port-forward service/loki 3100:3100
make start-standalone
```

Alternatively, you can start it without Loki/NetObserv, using mocked flows:

```bash
make serve-mock
```

Both options will start the standalone console server on http://localhost:9001/.

Note: this will provide a single page showing the main Netflow Traffic and Network Health pages. However, the OpenShift Console integration goes further, by providing more views directly integrated in other pages. These views obviously cannot be rendered without the OpenShift Console.

### Console plugin

Plugin can be served locally using the following command:

```bash
make serve
```

Make sure you are logged in your OpenShift cluster before with the CLI (`oc login -u kubeadmin` ...)

You need also to have a local copy of [console repository](https://github.com/openshift/console)
Build it once using:
```bash
./build.sh
```

Then, start the console bridge with this local plugin, with:
```bash
CONSOLE=/path/to/console make bridge
```

Then open http://localhost:9000/.

If you have troubles trying to run the console, refer to their doc: https://github.com/openshift/console/#openshift-no-authentication.

#### Loki in dev mode

You need to deploy Loki and port-forward on your host: `kubectl port-forward service/loki 3100:3100`

## OCI Image

Images are located on https://quay.io/repository/netobserv/network-observability-console-plugin. To use the latest image corresponding to branch `main`, use `quay.io/netobserv/network-observability-console-plugin:main`.

### Build

```bash
# build the default image (quay.io/netobserv/network-observability-console-plugin:main):
make image-build

# push the default image (quay.io/netobserv/network-observability-console-plugin:main):
make image-push

# build and push on your own quay.io account (quay.io/myuser/network-observability-console-plugin:dev):
IMAGE_ORG=myuser VERSION=dev make images

# build and push on a different registry
IMAGE=dockerhub.io/myuser/plugin:tag make images

# faster builds with default image / tag
BUILDSCRIPT=:dev make images
```

### Testing in OpenShift

Probably the easiest way to test without dev mode (e.g. to test a pull request) is to use the [operator](https://github.com/netobserv/network-observability-operator/), build and push the image to your own registry account and update the `network-observability-operator.vx.y.z` csv to update the plugin image.

E.g:

```bash
IMAGE=quay.io/${USER}/network-observability-console-plugin:pr-xx make images

oc get csv
NAME                                     DISPLAY                 VERSION   REPLACES                                 PHASE
network-observability-operator.v1.10.1   Network Observability   1.10.2    network-observability-operator.v1.10.0   Succeeded

oc edit csv network-observability-operator.v1.10.1
# Here replace image in the RELATED_IMAGE_CONSOLE_PLUGIN environment variable with the newly created one under .spec.install.spec.deployments[0].spec.template.spec.containers[0].env
```

If you had previously used the console with the plugin installed, you may need to restart console pods to clear cache:

```bash
oc delete pods -n openshift-console -l app=console
```

## Cypress tests

[Cypress](https://www.cypress.io/) is a framework for running frontend integration tests. Our tests are defined in [cypress/integration](./web/cypress/integration/).

You can run the cypress tests either with the OpenShift Console + NetObserv as a plugin, or with the NetObserv console deployed as a standalone as documented above.

### With the standalone mode

1. Start the [standalone mode](#standalone-console) as documented above. You should have the console accessible and working on http://localhost:9001

2. Edit [consts.js](./web/cypress/support/const.js) to set the URL to "http://localhost:9001".

3. Start cypress:

```bash
make cypress
```

4. Click on "Run N integration specs"

### With OpenShift Console and NetObserv as a plugin

1. Start your [dev environment](#development-environment) as documented above, including port-forwarding Loki. You should have the console accessible and working on http://localhost:9000/netflow-traffic

2. Start cypress:

```bash
make cypress
```

3. Click on "Run N integration specs"

## Updating schemas

This console plugin comes with several panels allowing GUI-based configuration for `FlowCollector` and other managed resources, including:

- Comprehensive forms for each of the resources (includes most supported settings that are pretty common to configure).
- Simplified wizards for faster configuration.

When you update the operator CRDs, you may have to update some schemas here as well, which contain some rules that drive how forms are displayed. Especially:

- [uiSchema.ts](./web/src/components/forms/config/uiSchema.ts) contains a display-oriented description of every CRD field, including whether or not they should be hidden, or if they have relationships with other fields.
- [< CRD name >-wizard.tsx](./web/src/components/forms/flowCollector-wizard.tsx) contains specific fields to be displayed in wizards.

When a CRD field is added, consider whether you need to update these files.

Additionally, [schemas.ts](./web/pluginToStandaloneMapper/schemas.ts) contains the full CRD schema as JSON, used in tests and in standalone mode, and should also be kept up to date. Use [generate-schemas.sh](./scripts/generate-schemas.sh) to regenerate them (you need a running cluster with the CRDs installed).
