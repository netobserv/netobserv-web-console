# AI Agents Best Practices for NetObserv Web Console

Best practices for AI coding agents on NetObserv Web Console.

> **Note**: Symlinked as [CLAUDE.md](CLAUDE.md) for Claude Code auto-loading.

## Project Context

**NetObserv Web Console** - OpenShift Console dynamic plugin for network
observability visualization (also deployable as standalone app).

**Stack:**
- **Frontend**: TypeScript, React 18, PatternFly 6, React Router 7, i18next 25
- **Plugin SDK**: `@openshift-console/dynamic-plugin-sdk` 4.22+ (plugin mode
  only)
- **Backend**: Go HTTP server for Loki queries, Kubernetes resources, Prometheus
  metrics

**Deployment Modes:**
- **Plugin**: Integrated into OpenShift Console (OCP 4.22+)
- **Standalone**: Independent web application

**PatternFly Version Support Matrix:**
| OCP Version | Branch | PatternFly |
|-------------|--------|------------|
| ≥ 4.22 | `main` | PF6 |
| 4.19-4.21 | `main` or `main-pf5` | PF6 or PF5 |
| 4.15-4.18 | `main-pf5` | PF5 |
| ≤ 4.14 | `main-pf4` | PF4 |

See
[OpenShift Console PatternFly documentation](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk#patternfly)
for plugin compatibility details.

**Key Directories:**
- `web/src/components/`: React components (forms, tables, topology, etc.)
- `web/src/api/`: Backend API client
- `web/src/model/`: Data models, transformations, and context providers
- `web/src/utils/`: Utility functions and custom React hooks
- `web/src/standalone/`: Standalone mode application entry point
- `pkg/handler/`: HTTP request handlers
- `pkg/loki/`: Loki client and query builders
- `pkg/kubernetes/`: Kubernetes API client
- `pkg/prometheus/`: Prometheus client
- `web/cypress/e2e/`: Cypress E2E tests on mock data
- `web/cypress/integration-tests/`: Integration tests with OpenShift

## Critical Constraints

### 🚨 OpenShift Console Plugin SDK
- Plugin mode must use `@openshift-console/dynamic-plugin-sdk` APIs
- Plugin mode must follow OpenShift Console conventions for navigation,
  extensions, theming
- Standalone mode uses the same codebase but without Console integration
- Test both plugin and standalone modes

### 🚨 Node Version
- Node.js 24 (source of truth: `Dockerfile.front`)
- `.npmrc` contains `legacy-peer-deps=true` for dependency resolution
- Use [nvm](https://github.com/nvm-sh/nvm) for version management

### 🚨 Dockerfiles
- `Dockerfile`: Production multi-stage build (frontend + backend)
- `Dockerfile.front`: Frontend build (Node.js version source of truth)
- `Dockerfile.downstream`: Downstream/productized builds
- `Dockerfile.ci`: CI environment builds
- `Dockerfile.e2e`, `Dockerfile.cypress`: Test runner images

### 🚨 i18n Strings
- All user-facing strings must use react-i18next
- Run `make i18n` to update translation files
- Never hardcode English strings in UI

## Effective Prompting

Be specific about file paths, existing patterns, and testing requirements.

**Good**: "Add dnslatency to ColumnsId enum in web/src/utils/columns.ts. Define
in config/sample-config.yaml. Update Loki query in pkg/loki/flow_query.go. Test
both modes."

**Bad**: "Add DNS latency column"

**Key Principles:**
1. Exact file paths (`web/src/components/`, not "frontend")
2. Reference existing patterns (columns, filters, Loki queries)
3. i18n for UI strings, dual-mode testing
4. Check package.json before adding dependencies
5. Column workflow: columns.ts enum → sample-config.yaml → optional RecordField
   rendering

## Common Task Templates

### Modify Backend Handler
```text
Add new API endpoint for zone filtering:
1. Add route in pkg/server/routes.go:
   - Register route with api.HandleFunc()
2. Add handler implementation in pkg/handler/ (e.g., resources.go):
   - Create handler function on Handlers struct
   - Validate query parameters
   - Use existing error handling patterns
3. Update pkg/loki/flow_query.go if Loki query needed
4. Update web/src/api/routes.ts with new endpoint
5. Add Go unit tests in pkg/handler/*_test.go
6. Test with both real Loki and mocks (see pkg/handler/lokiclientmock/)
```

### Update Schema Synchronization
```text
FlowCollector CRD field changed in operator:
1. Follow instructions in README.md#updating-schemas
2. Update web/src/components/forms/config/uiSchema.ts with new field display rules
3. Update web/src/model/flow-query.ts if query params change
4. Update web/src/components/tabs/netflow-overview/ if overview UI changes
5. Regenerate schemas using scripts/generate-schemas.sh (requires running cluster)
6. Test with both old and new FlowCollector versions
```

## Repository-Specific Context

### Frontend Architecture
- **Custom Hooks**: Logic extracted into focused hooks in
  `web/src/utils/*-hook.ts` (capabilities, URL sync, fetching, theme, storage,
  etc.)
- **Context**: `NetflowContext` in `web/src/model/netflow-context.ts` shares
  config/capabilities across components
- **React Router**: v7, centralized in `web/src/utils/url.ts`

### Plugin vs Standalone Modes
- **Plugin mode**: Console integration (localhost:9001), requires Console clone
  for dev
- **Standalone mode**: Independent app (`make start-standalone` or
  `make start-standalone-mock`), build with `STANDALONE=true make images`
- FLAVOR=`enduser` limits production standalone to Network Traffic/Health tabs

### Loki Query Optimization
- Limit time ranges, prefer `=` over `=~` matchers, push aggregations to LogQL
- Check `/api/loki/config/limits` for query constraints
- Mock mode: `make start-standalone-mock` or `make serve-mock`

### Frontend Configuration
- **Operator-Generated (Production)**: ConfigMap from FlowCollector CR, fetched
  via `/api/frontend-config`
  - Source:
    [static-frontend-config.yaml](https://github.com/netobserv/netobserv-operator/blob/main/internal/controller/consoleplugin/config/static-frontend-config.yaml)
    (operator repo) + FlowCollector spec
  - **Critical**: Changes to `config/sample-config.yaml` frontend section MUST
    be synced to operator's `static-frontend-config.yaml`
- **Development**: `config/sample-config.yaml` for local testing only

### PatternFly Components
- Version: v6.4+ (see `web/package.json`)
- Follow PatternFly patterns, test light/dark themes
- Docs: [patternfly.org/v6](https://www.patternfly.org/)

### Multi-Architecture
Support: amd64, arm64, ppc64le, s390x. Frontend built once, backend per arch.
Build: `MULTIARCH_TARGETS="amd64 arm64" make images`

## Code Review Checklist

```text
Review for:
1. TypeScript type safety (no 'any' types without justification)
2. PatternFly component usage consistency
3. i18n strings for all user-facing text
4. Error handling (proper error messages and patterns)
5. Unit tests (React Testing Library for frontend, Go tests for backend)
6. Loki query efficiency (time ranges, label matchers)
7. Both plugin and standalone mode testing
8. Accessibility (ARIA labels, keyboard navigation)
9. Performance (avoid unnecessary re-renders, optimize queries)
10. Usability and user experience (intuitive workflows, clear feedback)
```

## Testing

- **Unit**: Jest 30 + React Testing Library 16 (`web/src/**/__tests__/`), Go
  tests (`pkg/*_test.go`)
- **E2E**: `web/cypress/e2e/` - runs on mock data
- **Integration**: `web/cypress/integration-tests/` - requires OpenShift cluster
  (main branch: OCP 4.19+)
- **Run Cypress**: `make cypress` or `cd web && npm run cypress:open`

## Views Feature

Pre-configured view presets that auto-select relevant panels, columns, and
topology metrics for a specific feature in one click.

**Adding a new view preset:**
1. Add new `ViewPresetId` to the union type in `views.ts`
2. Add `ViewPreset` entry to `viewPresets[]` array with `requiredFeature`,
   `panels`, `columns`, `topologyMetricType`
3. Add i18n extraction hint comment in `view-selector.tsx`
4. Run `make i18n`
5. Add unit tests in `web/src/model/__tests__/views.spec.ts`

**Column IDs in presets:**
- Use `ColumnsId` enum values for standard columns
- Use raw string IDs (e.g. `'XlatSrcAddr'`) for columns not in the enum (dynamic
  config-only columns like Xlat* for packetTranslation)
- `ViewPreset.columns` is typed as `string[]` for this reason

**Local dev with features enabled:**
- Enable features in `config/sample-config.yaml` under `frontend.features`
- Restart `make start-standalone-mock` to regenerate `config/config.yaml`

## Quick Reference

**Essential Commands:**
```bash
make build                      # Build backend and frontend
make frontend                   # Build, lint, test frontend
make backend                    # Build, lint, test backend
make start-standalone           # Start standalone mode (requires Loki)
make start-standalone-mock      # Start standalone with mocked data
make bridge                     # Bridge plugin to OpenShift Console
make i18n                       # Update i18n translation files
make image-build image-push     # Build and push image
```

**Key Files:**
- Frontend config: [web/src/model/config.ts](web/src/model/config.ts)
- API routes: [web/src/api/routes.ts](web/src/api/routes.ts)
- Loki queries: [pkg/loki/flow_query.go](pkg/loki/flow_query.go),
  [pkg/loki/topology_query.go](pkg/loki/topology_query.go)
- Backend routes: [pkg/server/routes.go](pkg/server/routes.go)
- Backend handlers: [pkg/handler/handlers.go](pkg/handler/handlers.go)
- Table columns: [web/src/utils/columns.ts](web/src/utils/columns.ts)
- UI schema:
  [web/src/components/forms/config/uiSchema.ts](web/src/components/forms/config/uiSchema.ts)
- Sample config: [config/sample-config.yaml](config/sample-config.yaml)
- Views presets: [web/src/model/views.ts](web/src/model/views.ts)
- Views selector:
  [web/src/components/dropdowns/view-selector.tsx](web/src/components/dropdowns/view-selector.tsx)

## AI Workflow Example

```text
1. Research: "Explain how topology view fetches and renders network flows"
2. Plan: "Add edge highlighting for high-latency flows - suggest component changes"
3. Implement: "Implement with proper data filtering and PatternFly styling"
4. Review: "Review for performance impact and edge cases"
5. i18n: "Run make i18n to update translation files"
6. Test: "Provide Cypress test scenarios for edge highlighting"
```

## Contribution Checklist

Before commit:
1. AI code review
2. Add unit tests (React Testing Library for frontend, Go tests for backend)
3. Add Cypress tests for UI features
4. `make build lint test` (both frontend and backend)
5. `make i18n` (if UI strings changed)
6. Test both plugin and standalone modes
7. Update README.md (if new features added)
8. Conventional commit messages

## Resources

- [README.md](README.md) - Setup, build, test, deploy, run locally
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

**Remember**: AI agents need clear context. Always review generated code, test
thoroughly in both plugin and standalone modes, and follow project conventions.

