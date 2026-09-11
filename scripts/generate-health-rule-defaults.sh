#!/usr/bin/env bash
#
# Sync health-rule template defaults from the Network Observability Operator
# (DefaultHealthRules) into the console plugin TypeScript used by forms and
# the Network Health "Manage rules" drawer.
#
# Requires a local checkout of the operator (Go module) — similar to how
# generate-schemas.sh requires a cluster with CRDs installed.
#
# Usage:
#   ./scripts/generate-health-rule-defaults.sh
#   OPERATOR_PATH=/path/to/network-observability-operator ./scripts/generate-health-rule-defaults.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GEN_DIR="${ROOT}/scripts/gen-health-rule-defaults"
OUT="${ROOT}/web/src/components/forms/healthRule/variantDefaults.ts"

OPERATOR_PATH="${OPERATOR_PATH:-${ROOT}/../network-observability-operator}"

if [[ ! -f "${OPERATOR_PATH}/api/flowcollector/v1beta2/flowcollector_defaults.go" ]]; then
  echo "error: operator defaults not found at ${OPERATOR_PATH}" >&2
  echo "Set OPERATOR_PATH to your network-observability-operator checkout." >&2
  exit 1
fi

OPERATOR_PATH="$(cd "${OPERATOR_PATH}" && pwd)"

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

cp "${GEN_DIR}/main.go" "${tmpdir}/main.go"

cat > "${tmpdir}/go.mod" <<EOF
module github.com/netobserv/network-observability-console-plugin/scripts/gen-health-rule-defaults

go 1.26.0

require github.com/netobserv/netobserv-operator v0.0.0

replace github.com/netobserv/netobserv-operator => ${OPERATOR_PATH}
EOF

echo "Generating ${OUT} from ${OPERATOR_PATH} ..."
tmpout="$(mktemp "${OUT}.XXXXXX")"
trap 'rm -rf "${tmpdir}"; rm -f "${tmpout}"' EXIT
(
  cd "${tmpdir}"
  go mod tidy
  # Source uses //go:build ignore so the plugin module's go mod vendor skips it.
  go run -tags=ignore .
) > "${tmpout}"
mv "${tmpout}" "${OUT}"
trap 'rm -rf "${tmpdir}"' EXIT

echo "Wrote ${OUT}"
