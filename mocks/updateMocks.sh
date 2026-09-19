#!/usr/bin/env bash
# Refresh raw Loki fixtures used by backend mock mode (make serve-mock / start-standalone-mock).
#
# Prerequisites:
#   - jq, curl
#   - Loki reachable at LOKI_URL (default http://localhost:3100)
#     e.g. oc port-forward -n netobserv svc/loki 3100:3100
#
# Cypress flowmetrics fixtures are separate: go run ./scripts/enrich_cypress_flowmetrics.go
set -euo pipefail

cd "$(dirname "$0")"

LOKI_URL="${LOKI_URL:-http://localhost:3100}"
LOKI_TENANT="${LOKI_TENANT:-netobserv}"
OUT_DIR="./loki"
mkdir -p "${OUT_DIR}"

END_TS=$(date +%s)
START_TS=$((END_TS - 3600))
METRICS_STEP="30s"
METRICS_RATE="[5m]"

curl_loki() {
  local outfile="$1"
  local query="$2"
  shift 2
  local tmp="${outfile}.tmp.$$"
  echo "  -> ${outfile}"
  if curl -fsS -H "X-Scope-OrgID: ${LOKI_TENANT}" \
    --get "${LOKI_URL}/loki/api/v1/query_range" \
    --data-urlencode "query=${query}" \
    --data-urlencode "start=${START_TS}" \
    --data-urlencode "end=${END_TS}" \
    "$@" | jq . > "${tmp}"; then
    mv "${tmp}" "${outfile}"
  else
    rm -f "${tmp}"
    return 1
  fi
}

curl_label() {
  local outfile="$1"
  local label="$2"
  local tmp="${outfile}.tmp.$$"
  echo "  -> ${outfile}"
  if curl -fsS -H "X-Scope-OrgID: ${LOKI_TENANT}" \
    "${LOKI_URL}/loki/api/v1/label/${label}/values" | jq . > "${tmp}"; then
    mv "${tmp}" "${outfile}"
  else
    rm -f "${tmp}"
    return 1
  fi
}

STREAM='{app="netobserv-flowcollector"}'
METRICS_STREAM='{app="netobserv-flowcollector",FlowDirection="1"}'

echo 'Getting table flows'
curl_loki "${OUT_DIR}/flow_records.json" "${STREAM}" --data-urlencode "limit=50"
curl_loki "${OUT_DIR}/flow_records_dropped.json" \
  "${STREAM}!~\`\"Packets\"\`|~\`\"PktDropPackets\":[1-9][0-9]*[,}]\`" \
  --data-urlencode "limit=50"
curl_loki "${OUT_DIR}/flow_records_has_dropped.json" \
  "${STREAM}|~\`\"PktDropPackets\":[1-9][0-9]*[,}]\`" \
  --data-urlencode "limit=50"
curl_loki "${OUT_DIR}/flow_records_sent.json" \
  "${STREAM}!~\`\"PktDropPackets\"\`" \
  --data-urlencode "limit=50"

echo 'Getting metrics (Bytes)'
metrics_query() {
  local by="$1"
  local outfile="$2"
  local topk="${3:-50}"
  curl_loki "${outfile}" \
    "topk(${topk},sum by(${by})(rate(${METRICS_STREAM}|json|unwrap Bytes|__error__=\"\"${METRICS_RATE})))" \
    --data-urlencode "limit=${topk}" \
    --data-urlencode "step=${METRICS_STEP}"
}

metrics_query "app" "${OUT_DIR}/flow_metrics_app.json" 5
metrics_query "K8S_ClusterName" "${OUT_DIR}/flow_metrics_cluster.json"
metrics_query "SrcK8S_NetworkName,DstK8S_NetworkName" "${OUT_DIR}/flow_metrics_udn.json"
metrics_query "SrcK8S_Zone,DstK8S_Zone" "${OUT_DIR}/flow_metrics_zone.json"
metrics_query "SrcK8S_HostName,DstK8S_HostName" "${OUT_DIR}/flow_metrics_host.json"
metrics_query "SrcK8S_Namespace,DstK8S_Namespace" "${OUT_DIR}/flow_metrics_namespace.json"
metrics_query "SrcK8S_OwnerName,SrcK8S_OwnerType,DstK8S_OwnerName,DstK8S_OwnerType,SrcK8S_Namespace,DstK8S_Namespace" \
  "${OUT_DIR}/flow_metrics_owner.json"
metrics_query "SrcK8S_Name,SrcK8S_Type,SrcK8S_OwnerName,SrcK8S_OwnerType,SrcK8S_Namespace,SrcAddr,SrcK8S_HostName,DstK8S_Name,DstK8S_Type,DstK8S_OwnerName,DstK8S_OwnerType,DstK8S_Namespace,DstAddr,DstK8S_HostName" \
  "${OUT_DIR}/flow_metrics_resource.json"

echo 'Getting dropped metrics (PktDropPackets)'
dropped_metrics_query() {
  local by="$1"
  local outfile="$2"
  local topk="${3:-50}"
  curl_loki "${outfile}" \
    "topk(${topk},sum by(${by})(rate(${METRICS_STREAM}|json|unwrap PktDropPackets|__error__=\"\"${METRICS_RATE})))" \
    --data-urlencode "limit=${topk}" \
    --data-urlencode "step=${METRICS_STEP}"
}

dropped_metrics_query "app" "${OUT_DIR}/flow_metrics_dropped_app.json" 5
dropped_metrics_query "PktDropLatestState" "${OUT_DIR}/flow_metrics_dropped_state.json" 5
dropped_metrics_query "PktDropLatestDropCause" "${OUT_DIR}/flow_metrics_dropped_cause.json" 5
dropped_metrics_query "SrcK8S_NetworkName,DstK8S_NetworkName" "${OUT_DIR}/flow_metrics_dropped_udn.json"
dropped_metrics_query "SrcK8S_HostName,DstK8S_HostName" "${OUT_DIR}/flow_metrics_dropped_host.json"
dropped_metrics_query "SrcK8S_Namespace,DstK8S_Namespace" "${OUT_DIR}/flow_metrics_dropped_namespace.json"
dropped_metrics_query "SrcK8S_OwnerName,SrcK8S_OwnerType,DstK8S_OwnerName,DstK8S_OwnerType,SrcK8S_Namespace,DstK8S_Namespace" \
  "${OUT_DIR}/flow_metrics_dropped_owner.json"
dropped_metrics_query "SrcK8S_Name,SrcK8S_Type,SrcK8S_OwnerName,SrcK8S_OwnerType,SrcK8S_Namespace,SrcAddr,SrcK8S_HostName,DstK8S_Name,DstK8S_Type,DstK8S_OwnerName,DstK8S_OwnerType,DstK8S_Namespace,DstAddr,DstK8S_HostName" \
  "${OUT_DIR}/flow_metrics_dropped_resource.json"

echo 'Getting namespaces'
curl_label "${OUT_DIR}/namespaces.json" "SrcK8S_Namespace"

echo "Done. Wrote fixtures under ${OUT_DIR}/"
