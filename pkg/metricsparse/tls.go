package metricsparse

import (
	"encoding/json"
	"strings"

	pmodel "github.com/prometheus/common/model"
)

func uniqueStrings(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func extractTLSListField(raw string) []string {
	s := strings.TrimSpace(raw)
	if s == "" || s == "[]" || s == "null" {
		return nil
	}
	if strings.HasPrefix(s, "[") {
		var parsed []interface{}
		if err := json.Unmarshal([]byte(s), &parsed); err == nil {
			out := make([]string, 0, len(parsed))
			for _, v := range parsed {
				if v == nil {
					continue
				}
				out = append(out, strings.TrimSpace(toString(v)))
			}
			return uniqueStrings(out)
		}
		return []string{s}
	}
	if strings.Contains(s, ",") {
		parts := strings.Split(s, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				out = append(out, p)
			}
		}
		return uniqueStrings(out)
	}
	return []string{s}
}

func toString(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strings.TrimRight(strings.TrimRight(jsonNumber(t), "0"), ".")
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		b, _ := json.Marshal(t)
		return string(b)
	}
}

func jsonNumber(f float64) string {
	b, _ := json.Marshal(f)
	return string(b)
}

func tlsFromMetric(m pmodel.Metric) *MetricTLS {
	versions := extractTLSListField(labelString(m, "TLSVersion"))
	groups := extractTLSListField(labelString(m, "TLSGroup"))
	if len(versions) == 0 && len(groups) == 0 {
		return nil
	}
	tls := &MetricTLS{}
	if len(versions) > 0 {
		tls.Versions = versions
	}
	if len(groups) > 0 {
		tls.Groups = groups
	}
	return tls
}
