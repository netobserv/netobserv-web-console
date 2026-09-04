# VERSION defines the project version for the bundle.
# Update this value when you upgrade the version of your project.
# To re-generate a bundle for another specific version without changing the standard setup, you can:
# - use the VERSION as arg of the bundle target (e.g make bundle VERSION=0.0.2)
# - use environment variables to overwrite this value (e.g export VERSION=0.0.2)
VERSION ?= main

# Go architecture and targets images to build
GOARCH ?= amd64
MULTIARCH_TARGETS ?= amd64

# Setting SHELL to bash allows bash commands to be executed by recipes.
SHELL := /usr/bin/env bash

# In CI, to be replaced by `netobserv`
IMAGE_ORG ?= $(USER)

# Image registry such as quay or docker
IMAGE_REGISTRY ?= quay.io

# IMAGE_TAG_BASE defines the namespace and part of the image name for remote images.
IMAGE_TAG_BASE ?= $(IMAGE_REGISTRY)/${IMAGE_ORG}/network-observability-console-plugin

# Standalone `true` is used to build frontend outside of OCP Console environment
# see .mk/standalone.mk
STANDALONE ?= false

ifeq (${STANDALONE}, true)
	BUILDSCRIPT = :standalone
	FLAVOR = enduser
	IMAGE_TAG_BASE := $(IMAGE_REGISTRY)/${IMAGE_ORG}/network-observability-standalone-frontend
endif

# Image URL to use all building/pushing image targets
IMAGE ?= ${IMAGE_TAG_BASE}:${VERSION}

# Image building tool (docker / podman) - docker is preferred in CI
OCI_BIN_PATH = $(shell which docker 2>/dev/null || which podman)
OCI_BIN ?= $(shell basename ${OCI_BIN_PATH})
OCI_BUILD_OPTS ?=

ifeq ("$(OCI_BIN)","docker")
# https://stackoverflow.com/questions/75521775/buildx-docker-image-claims-to-be-a-manifest-list
EXTRA_BUILD_FLAGS ?= --provenance=false
endif

ifneq ($(CLEAN_BUILD),)
	BUILD_DATE := $(shell date +%Y-%m-%d\ %H:%M)
	BUILD_SHA := $(shell git rev-parse --short=8 HEAD)
	LDFLAGS ?= -X 'main.buildVersion=${VERSION}-${BUILD_SHA}' -X 'main.buildDate=${BUILD_DATE}'
endif

GOLANGCI_LINT_VERSION = v2.12.2
NPM_INSTALL ?= install
CMDLINE_ARGS ?= --loglevel trace --config config/config.yaml

.DEFAULT_GOAL := help

# build a single arch target provided as argument
define build_target
	echo 'building image for arch $(1)'; \
	DOCKER_BUILDKIT=1 $(OCI_BIN) buildx build --load --build-arg LDFLAGS="${LDFLAGS}" --build-arg TARGETARCH=$(1) ${OCI_BUILD_OPTS} ${EXTRA_BUILD_FLAGS} -t ${IMAGE}-$(1) -f Dockerfile .;
endef

# push a single arch target image
define push_target
	echo 'pushing image ${IMAGE}-$(1)'; \
	DOCKER_BUILDKIT=1 $(OCI_BIN) push ${IMAGE}-$(1);
endef

# manifest create a single arch target provided as argument
define manifest_add_target
	echo 'manifest add target $(1)'; \
	DOCKER_BUILDKIT=1 $(OCI_BIN) manifest add ${IMAGE} ${IMAGE}-$(target);
endef

##@ General

# The help target prints out all targets with their descriptions organized
# beneath their categories. The categories are represented by '##@' and the
# target descriptions by '##'. The awk commands is responsible for reading the
# entire set of makefiles included in this invocation, looking for lines of the
# file as xyz: ## something, and then pretty-format the target and help. Then,
# if there's a line with ##@ something, that gets pretty-printed as a category.
# More info on the usage of ANSI control characters for terminal formatting:
# https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
# More info on the awk command:
# http://linuxcommand.org/lc3_adv_awk.php

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: prereqs
prereqs: ## Test if prerequisites are met, and installing missing dependencies
	@echo "### Test if prerequisites are met, and installing missing dependencies"
	test -f ./bin/golangci-lint-${GOLANGCI_LINT_VERSION} || ( \
		curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh | sh -s ${GOLANGCI_LINT_VERSION} \
		&& mv ./bin/golangci-lint ./bin/golangci-lint-${GOLANGCI_LINT_VERSION})

.PHONY: vendors
vendors: ## Check go vendors
	@echo "### Checking vendors"
	go mod tidy && go mod vendor

.PHONY: yq
YQ = ./bin/yq
YQ: ## Download yq locally if necessary.
ifeq (,$(shell which $(YQ) 2>/dev/null))
	@{ \
	echo "### Downloading yq"; \
	set -e ;\
	mkdir -p $(dir $(YQ)) ;\
	OS=$(shell go env GOOS) && ARCH=$(shell go env GOARCH) && \
	curl -sSLo $(YQ) https://github.com/mikefarah/yq/releases/download/v4.35.2/yq_$${OS}_$${ARCH} ;\
	chmod +x $(YQ) ;\
	}
endif

##@ Develop

.PHONY: start
start: YQ build-backend install-frontend ## Run backend and frontend
	$(YQ) '.server.port |= 9002 | .server.metricsPort |= 9003 | .consoleMode |= "Standalone"' ./config/sample-config.yaml > ./config/config.yaml
	@echo "### Starting backend on http://localhost:9002"
	bash -c "trap 'lsof -ti tcp:9002 | xargs kill -9 2>/dev/null || true' EXIT; \
					./plugin-backend $(CMDLINE_ARGS) & cd web && npm run start"

.PHONY: start-backend
start-backend: YQ build-backend
	$(YQ) '.server.port |= 9002 | .server.metricsPort |= 9003 | .consoleMode |= "Standalone"' ./config/sample-config.yaml > ./config/config.yaml
	bash -c "trap 'lsof -ti tcp:9002 | xargs kill -9 2>/dev/null || true' EXIT; \
					./plugin-backend $(CMDLINE_ARGS)"

.PHONY: bridge
bridge: ## Bridge OCP console
ifeq (,${CONSOLE})
	@echo "CONSOLE must be set to your local path of the console repository clone. E.g. CONSOLE=/path/to/console make bridge"
else
	@echo "### Setting bridge from ${CONSOLE} to http://localhost:9000/netflow-traffic"
	cd ${CONSOLE} && source contrib/oc-environment.sh && ./bin/bridge -plugins netobserv-plugin=http://localhost:9001/ --plugin-proxy='{"services":[{"consoleAPIPath":"/api/proxy/plugin/netobserv-plugin/backend/","endpoint":"http://localhost:9001"}]}'
	cd -
endif

.PHONY: update-config
update-config: ## Update sample config from operator repo
	./scripts/update-config.sh

##@ Develop frontend

.PHONY: install-frontend
install-frontend: ## Run frontend npm install
	@echo "### Installing frontend dependencies"
	cd web && npm ${NPM_INSTALL}

.PHONY: fmt-frontend
fmt-frontend: i18n ## Run frontend i18n and fmt
	cd web && npm run format-all

.PHONY: lint-frontend
lint-frontend: ## Lint frontend code
	@echo "### Linting frontend code"
	cd web && npm run lint

.PHONY: test-frontend
test-frontend: ## Test frontend using jest
	@echo "### Testing frontend"
	cd web && npm run test

##@ Develop backend

.PHONY: build-backend
build-backend: fmt-backend ## Build backend
	@echo "### Building backend"
	GOARCH=${GOARCH} go build ${BUILD_FLAGS} -mod vendor -o plugin-backend cmd/plugin-backend.go

.PHONY: fmt-backend
fmt-backend: ## Run backend go fmt
	go fmt ./...

.PHONY: lint-backend
lint-backend: prereqs ## Lint backend code
	@echo "### Linting backend code"
	./bin/golangci-lint-${GOLANGCI_LINT_VERSION} run ./...

.PHONY: test-backend
test-backend: ## Test backend using go test
	@echo "### Testing backend"
	go test ./... -coverpkg=./... -coverprofile cover.out

##@ Performance Testing

.PHONY: benchmark-server
benchmark-server: ## Run server performance benchmarks
	@echo "### Running server performance benchmarks..."
	go test -bench=. -benchmem -benchtime=300ms ./pkg/server/ -run=^$$ | tee pkg/server/benchmark-results.txt
	@echo "Results saved to pkg/server/benchmark-results.txt"

.PHONY: benchmark-server-compare
benchmark-server-compare: ## Compare benchmark results with baseline using benchstat
	@echo "### Running benchmarks and comparing with baseline..."
	@GOPATH=$$(go env GOPATH); \
	BENCHSTAT="$$GOPATH/bin/benchstat"; \
	if [ ! -x "$$BENCHSTAT" ]; then \
		echo "Installing benchstat..."; \
		go install golang.org/x/perf/cmd/benchstat@latest; \
	fi; \
	if [ ! -f pkg/server/benchmark-baseline.txt ]; then \
		echo "No baseline found. Creating baseline..."; \
		go test -bench=. -benchmem -benchtime=300ms ./pkg/server/ -run=^$$ | tee pkg/server/benchmark-baseline.txt; \
		echo "Baseline created. Run 'make benchmark-server-compare' again to compare."; \
	else \
		echo "Running benchmarks..."; \
		go test -bench=. -benchmem -benchtime=300ms ./pkg/server/ -run=^$$ | tee pkg/server/benchmark-current.txt; \
		echo ""; \
		echo "=== Performance Comparison (baseline vs current) ==="; \
		$$BENCHSTAT -alpha 0.05 pkg/server/benchmark-baseline.txt pkg/server/benchmark-current.txt || true; \
		echo ""; \
		echo "Benchmark comparison completed. Review results above for any performance changes."; \
	fi

# Convenient targets for specific benchmark groups
.PHONY: benchmark-export
benchmark-export: ## Run export flows benchmarks
	@go test -bench=BenchmarkExport -benchmem -benchtime=300ms ./pkg/server/ -run=^$$

.PHONY: benchmark-large
benchmark-large: ## Run large result sets benchmarks
	@go test -bench=BenchmarkLargeResultSets -benchmem -benchtime=300ms ./pkg/server/ -run=^$$

.PHONY: benchmark-filters
benchmark-filters: ## Run filter-heavy query benchmarks (all views)
	@go test -bench=BenchmarkFilterHeavy -benchmem -benchtime=300ms ./pkg/server/ -run=^$$

.PHONY: benchmark-concurrent
benchmark-concurrent: ## Run concurrent user scenario benchmarks (all views)
	@go test -bench=BenchmarkConcurrent -benchmem -benchtime=300ms ./pkg/server/ -run=^$$

.PHONY: benchmark-aggregations
benchmark-aggregations: ## Run aggregation level benchmarks
	@go test -bench="BenchmarkTopologyAggregations|BenchmarkOverviewAggregations" -benchmem -benchtime=300ms ./pkg/server/ -run=^$$

.PHONY: serve
serve: YQ ## Run backend
	$(YQ) '.server.port |= 9001 | .server.metricsPort |= 9002 | .consoleMode |= "Standalone"' ./config/sample-config.yaml > ./config/config.yaml
	./plugin-backend $(CMDLINE_ARGS)

.PHONY: serve-mock
serve-mock: YQ ## Run backend using mocks
	$(YQ) '.server.port |= 9001 | .server.metricsPort |= 9002 | .consoleMode |= "Mock"' ./config/sample-config.yaml > ./config/config.yaml
	./plugin-backend $(CMDLINE_ARGS)

##@ Images

# note: to build and push custom image tag use: IMAGE_ORG=myuser VERSION=dev make images
.PHONY: image-build
image-build: ## Build MULTIARCH_TARGETS images
	$(OCI_BIN) build --ulimit nofile=20480:20480 --build-arg BUILDSCRIPT=${BUILDSCRIPT} --build-arg FLAVOR=${FLAVOR} ${OCI_BUILD_OPTS} -t localhost/local-front-build:latest -f Dockerfile.front .
	trap 'exit' INT; \
	$(foreach target,$(MULTIARCH_TARGETS),$(call build_target,$(target)))

.PHONY: image-push
image-push: ## Push MULTIARCH_TARGETS images
	trap 'exit' INT; \
	$(foreach target,$(MULTIARCH_TARGETS),$(call push_target,$(target)))

.PHONY: manifest-build
manifest-build: ## Build MULTIARCH_TARGETS manifest
	@echo 'building manifest $(IMAGE)'
	DOCKER_BUILDKIT=1 $(OCI_BIN) rmi ${IMAGE} -f
	DOCKER_BUILDKIT=1 $(OCI_BIN) manifest create ${IMAGE} $(foreach target,$(MULTIARCH_TARGETS), --amend ${IMAGE}-$(target));

.PHONY: manifest-push
manifest-push: ## Push MULTIARCH_TARGETS manifest
	@echo 'publish manifest $(IMAGE)'
ifeq (${OCI_BIN}, docker)
	DOCKER_BUILDKIT=1 $(OCI_BIN) manifest push ${IMAGE};
else
	DOCKER_BUILDKIT=1 $(OCI_BIN) manifest push ${IMAGE} docker://${IMAGE};
endif

.PHONY: tar-image
tar-image: MULTIARCH_TARGETS=amd64
tar-image: image-build ## Build single arch (amd64) and save as a tar
	$(OCI_BIN) tag $(IMAGE)-amd64 $(IMAGE)
	mkdir -p ./out
ifeq (${STANDALONE}, true)
	$(OCI_BIN) save -o out/image-standalone.tar $(IMAGE)
	echo $(IMAGE) > ./out/name-standalone
else
	$(OCI_BIN) save -o out/image.tar $(IMAGE)
	echo $(IMAGE) > ./out/name
endif

include .mk/cypress.mk
include .mk/shortcuts.mk
include .mk/standalone.mk
include .mk/static.mk
