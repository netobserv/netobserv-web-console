package metricsparse

import (
	"encoding/json"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
)

const (
	// ResultTypeTopologyMetrics is returned by EnrichMatrix for Src/Dst topology series.
	ResultTypeTopologyMetrics = "topologyMetrics"
	// ResultTypeGenericMetrics is returned for single-label aggregate series.
	ResultTypeGenericMetrics = "genericMetrics"

	idUnknown = "-"

	topologyTLSVersionAggregateSuffix = "__TLSVersion"

	latencyTolerance = 120
)

// NameAndType mirrors the frontend NameAndType type.
type NameAndType struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// Peer is a serializable TopologyMetricPeer (without getDisplayName).
type Peer struct {
	ID           string            `json:"id"`
	Addr         string            `json:"addr,omitempty"`
	Owner        *NameAndType      `json:"owner,omitempty"`
	Resource     *NameAndType      `json:"resource,omitempty"`
	ResourceKind string            `json:"resourceKind,omitempty"`
	IsAmbiguous  bool              `json:"isAmbiguous"`
	SubnetLabel  string            `json:"subnetLabel,omitempty"`
	Scopes       map[string]string `json:"-"`
}

// MarshalJSON flattens scope fields onto the peer object (FE expects namespace, host, … as top-level keys).
func (p Peer) MarshalJSON() ([]byte, error) { //nolint:gocritic // value receiver required for json.Marshal(Peer)
	return marshalPeerJSON(&p)
}

func marshalPeerJSON(p *Peer) ([]byte, error) {
	m := map[string]interface{}{
		"id":          p.ID,
		"isAmbiguous": p.IsAmbiguous,
	}
	if p.Addr != "" {
		m["addr"] = p.Addr
	}
	if p.Owner != nil {
		m["owner"] = p.Owner
	}
	if p.Resource != nil {
		m["resource"] = p.Resource
	}
	if p.ResourceKind != "" {
		m["resourceKind"] = p.ResourceKind
	}
	if p.SubnetLabel != "" {
		m["subnetLabel"] = p.SubnetLabel
	}
	for k, v := range p.Scopes {
		if v != "" {
			m[k] = v
		}
	}
	return json.Marshal(m)
}

// UnmarshalJSON reads flattened scope fields back into Scopes.
func (p *Peer) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	known := map[string]struct{}{
		"id": {}, "addr": {}, "owner": {}, "resource": {}, "resourceKind": {},
		"isAmbiguous": {}, "subnetLabel": {}, "getDisplayName": {},
	}
	if v, ok := raw["id"]; ok {
		_ = json.Unmarshal(v, &p.ID)
	}
	if v, ok := raw["addr"]; ok {
		_ = json.Unmarshal(v, &p.Addr)
	}
	if v, ok := raw["owner"]; ok {
		var nt NameAndType
		if err := json.Unmarshal(v, &nt); err == nil {
			p.Owner = &nt
		}
	}
	if v, ok := raw["resource"]; ok {
		var nt NameAndType
		if err := json.Unmarshal(v, &nt); err == nil {
			p.Resource = &nt
		}
	}
	if v, ok := raw["resourceKind"]; ok {
		_ = json.Unmarshal(v, &p.ResourceKind)
	}
	if v, ok := raw["isAmbiguous"]; ok {
		_ = json.Unmarshal(v, &p.IsAmbiguous)
	}
	if v, ok := raw["subnetLabel"]; ok {
		_ = json.Unmarshal(v, &p.SubnetLabel)
	}
	p.Scopes = map[string]string{}
	for k, v := range raw {
		if _, skip := known[k]; skip {
			continue
		}
		var s string
		if err := json.Unmarshal(v, &s); err == nil && s != "" {
			p.Scopes[k] = s
		}
	}
	return nil
}

// MetricStats mirrors the frontend MetricStats type.
type MetricStats struct {
	Sum         float64   `json:"sum"`
	Latest      float64   `json:"latest"`
	Avg         float64   `json:"avg"`
	Min         float64   `json:"min"`
	Max         float64   `json:"max"`
	Percentiles []float64 `json:"percentiles"`
	Total       float64   `json:"total"`
}

// MetricTLS holds TLSVersion / TLSGroup extracted from matrix labels.
type MetricTLS struct {
	Versions []string `json:"versions,omitempty"`
	Groups   []string `json:"groups,omitempty"`
}

// Datapoint is a [timestamp, value] pair.
type Datapoint [2]float64

// TopologyMetric mirrors frontend TopologyMetrics (serializable).
type TopologyMetric struct {
	Source      Peer        `json:"source"`
	Destination Peer        `json:"destination"`
	Values      []Datapoint `json:"values"`
	Stats       MetricStats `json:"stats"`
	Scope       string      `json:"scope"`
	TLS         *MetricTLS  `json:"tls,omitempty"`
}

// GenericMetric mirrors frontend GenericMetric.
type GenericMetric struct {
	Name        string      `json:"name"`
	Values      []Datapoint `json:"values"`
	Stats       MetricStats `json:"stats"`
	AggregateBy string      `json:"aggregateBy"`
	TLS         *MetricTLS  `json:"tls,omitempty"`
}

// EnrichInput configures matrix enrichment.
type EnrichInput struct {
	AggregateBy string
	Scopes      []config.Scope
	// TimeRangeSeconds > 0 means a relative range ending at UnixTimestamp.
	TimeRangeSeconds int64
	// From/To used when TimeRangeSeconds == 0 (absolute range).
	From          int64
	To            int64
	UnixTimestamp int64
	ForceZeros    bool
	IsMock        bool
}

func customScopes(scopes []config.Scope) []config.Scope {
	out := make([]config.Scope, 0, len(scopes))
	for i := range scopes {
		switch scopes[i].ID {
		case "owner", "resource", "addr":
			continue
		default:
			out = append(out, scopes[i])
		}
	}
	return out
}
