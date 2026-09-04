//go:build ignore

// Command enrich_cypress_flowmetrics converts Cypress flowmetrics matrix fixtures
// into backend-enriched topologyMetrics payloads so the UI no longer needs a
// client-side matrix parse fallback.
//
// Usage (from repo root):
//
//	go run ./scripts/enrich_cypress_flowmetrics.go
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/metricsparse"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

// fixtureAggregateBy maps fixture basename → aggregateBy used when the fixture
// was captured for topology intercepts (matches Cypress scope selection).
var fixtureAggregateBy = map[string]string{
	"cluster.json":      "cluster",
	"zone.json":         "zone",
	"namespace.json":    "namespace",
	"NS.json":           "resource",
	"owner.json":        "owner",
	"Owners.json":       "owner",
	"resource.json":     "resource",
	"NSOwners.json":     "resource",
	"hosts.json":        "host",
	"hostsNS.json":      "resource",
	"hostsOwners.json":  "resource",
	"flow_metrics_perf.json": "resource",
}

var defaultScopes = []config.Scope{
	{ID: "cluster", Name: "Cluster", Labels: []string{"K8S_ClusterName"}},
	{ID: "zone", Name: "Zone", Labels: []string{"SrcK8S_Zone", "DstK8S_Zone"}},
	{ID: "host", Name: "Node", Labels: []string{"SrcK8S_HostName", "DstK8S_HostName"}},
	{ID: "namespace", Name: "Namespace", Labels: []string{"SrcK8S_Namespace", "DstK8S_Namespace"}},
	{ID: "owner", Name: "Owner", Labels: []string{"SrcK8S_OwnerName", "SrcK8S_OwnerType", "DstK8S_OwnerName", "DstK8S_OwnerType", "SrcK8S_Namespace", "DstK8S_Namespace"}},
	{ID: "resource", Name: "Resource", Labels: []string{"SrcK8S_Name", "SrcK8S_Type", "SrcK8S_OwnerName", "SrcK8S_OwnerType", "SrcK8S_Namespace", "SrcAddr", "SrcK8S_HostName", "DstK8S_Name", "DstK8S_Type", "DstK8S_OwnerName", "DstK8S_OwnerType", "DstK8S_Namespace", "DstAddr", "DstK8S_HostName"}},
}

type fixtureDoc struct {
	ResultType    string          `json:"resultType"`
	Result        json.RawMessage `json:"result"`
	Stats         json.RawMessage `json:"stats,omitempty"`
	UnixTimestamp int64           `json:"unixTimestamp"`
	IsMock        *bool           `json:"isMock,omitempty"`
}

func main() {
	roots := []string{
		"web/cypress/fixtures/flowmetrics",
		"web/cypress/fixtures/perf",
	}
	converted := 0
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			fatalf("read %s: %v", root, err)
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			agg, ok := fixtureAggregateBy[e.Name()]
			if !ok {
				continue
			}
			path := filepath.Join(root, e.Name())
			convertedOK, err := convertFixture(path, agg)
			if err != nil {
				fatalf("%s: %v", path, err)
			}
			if convertedOK {
				fmt.Printf("enriched %s (aggregateBy=%s)\n", path, agg)
				converted++
			}
		}
	}
	if converted == 0 {
		fatalf("no fixtures converted")
	}
	fmt.Printf("done: %d fixtures\n", converted)
}

func convertFixture(path, aggregateBy string) (bool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false, err
	}
	var doc fixtureDoc
	if err := json.Unmarshal(raw, &doc); err != nil {
		return false, fmt.Errorf("unmarshal: %w", err)
	}
	if doc.ResultType != "matrix" {
		fmt.Printf("skip %s (resultType=%s)\n", path, doc.ResultType)
		return false, nil
	}

	var matrix model.Matrix
	if err := json.Unmarshal(doc.Result, &matrix); err != nil {
		return false, fmt.Errorf("unmarshal matrix: %w", err)
	}

	in := metricsparse.EnrichInput{
		AggregateBy:   aggregateBy,
		Scopes:        defaultScopes,
		UnixTimestamp: doc.UnixTimestamp,
		ForceZeros:    true,
		IsMock:        true,
		TimeRangeSeconds: 300,
	}

	metrics := metricsparse.EnrichTopology(matrix, &in)

	out := map[string]interface{}{
		"resultType":    metricsparse.ResultTypeTopologyMetrics,
		"result":        metrics,
		"unixTimestamp": doc.UnixTimestamp,
	}
	if len(doc.Stats) > 0 {
		var stats interface{}
		if err := json.Unmarshal(doc.Stats, &stats); err != nil {
			return false, fmt.Errorf("unmarshal stats: %w", err)
		}
		out["stats"] = stats
	}
	if doc.IsMock != nil {
		out["isMock"] = *doc.IsMock
	}

	encoded, err := json.MarshalIndent(out, "", "    ")
	if err != nil {
		return false, err
	}
	encoded = append(encoded, '\n')
	if err := os.WriteFile(path, encoded, 0o644); err != nil {
		return false, err
	}
	return true, nil
}

func fatalf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
