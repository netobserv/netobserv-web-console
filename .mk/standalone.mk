##@ Standalone
.PHONY: start-frontend-standalone
start-frontend-standalone: install-frontend ## Run frontend as standalone
	cd web && FLAVOR=${FLAVOR} npm run start:standalone

.PHONY: start-standalone
start-standalone: YQ build-backend install-frontend ## Run backend and frontend as standalone
	$(YQ) '.server.port |= 9002 | .server.metricsPort |= 9003 | .consoleMode |= "Standalone"' ./config/sample-config.yaml > ./config/config.yaml
	@echo "### Starting backend on http://localhost:9002"
	bash -c "trap 'lsof -ti tcp:9002 | xargs kill -9 2>/dev/null || true' EXIT; \
					./plugin-backend $(CMDLINE_ARGS) & cd web && FLAVOR=${FLAVOR} npm run start:standalone"

.PHONY: start-standalone-mock
start-standalone-mock: YQ build-backend install-frontend ## Run backend using mocks and frontend as standalone
	$(YQ) '.server.port |= 9002 | .server.metricsPort |= 9003 | .consoleMode |= "Mock"' ./config/sample-config.yaml > ./config/config.yaml
	@echo "### Starting backend on http://localhost:9002 using mock"
	bash -c "trap 'lsof -ti tcp:9002 | xargs kill -9 2>/dev/null || true' EXIT; \
					./plugin-backend $(CMDLINE_ARGS) & cd web && FLAVOR=${FLAVOR} npm run start:standalone"

.PHONY: just-build-frontend
just-build-frontend: ## Build frontend
	@echo "### Building frontend"
	cd web && TYPECHECK=${TYPECHECK} FLAVOR=${FLAVOR} npm run build${BUILDSCRIPT}

.PHONY: build-frontend-standalone
build-frontend-standalone: install-frontend fmt-frontend ## Run npm install, format and build frontend as standalone
	@echo "### Building frontend standalone"
	cd web && FLAVOR=${FLAVOR} npm run build:standalone
