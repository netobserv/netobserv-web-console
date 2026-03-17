package prometheus

import (
	"slices"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/sirupsen/logrus"
)

var (
	log = logrus.WithField("module", "prometheus")
)

type Inventory struct {
	metrics []config.MetricInfo
}

func NewInventory(cfg *config.Prometheus) *Inventory {
	var toAppend []config.MetricInfo
	for i := range cfg.Metrics {
		// Set default direction to Any if unset
		if cfg.Metrics[i].Direction == "" {
			cfg.Metrics[i].Direction = config.AnyDirection
		}
		// Add DNS counter(s)
		if strings.Contains(cfg.Metrics[i].Name, "_dns_latency_seconds") {
			cpy := cfg.Metrics[i]
			cpy.Name += "_count"
			cpy.ValueField = constants.MetricTypeDNSFlows
			toAppend = append(toAppend, cpy)
		}
	}
	return &Inventory{metrics: append(cfg.Metrics, toAppend...)}
}

type SearchResult struct {
	Found         []string // Multiple metrics in case we need to run <ingress metric> OR <egress metric>
	Candidates    []string
	MissingLabels map[string][]string
}

func (i *Inventory) Search(neededLabels []string, valueField string) SearchResult {
	// Search for any direction
	r0 := i.searchWithDir(neededLabels, valueField, config.AnyDirection)
	if r0.Found != nil {
		return r0
	}
	// Try Ingress + Egress; If both Ingress and Egress metrics exist, they will be OR'ed, priority given to Ingress. Else only the existing ones are used.
	// User must enable Ingress and Egress metrics to get the best results
	r1 := i.searchWithDir(neededLabels, valueField, config.Ingress)
	r2 := i.searchWithDir(neededLabels, valueField, config.Egress)
	if r2.Found != nil {
		// Merge with r1 and return r1
		r1.Found = append(r1.Found, r2.Found...)
	}
	r1.Candidates = append(r1.Candidates, r0.Candidates...)
	r1.Candidates = append(r1.Candidates, r2.Candidates...)
	return r1
}

func (i *Inventory) searchWithDir(neededLabels []string, valueField string, dir config.FlowDirection) SearchResult {
	sr := SearchResult{}
	// Special case, when the query has a filter to PktDropState/Cause and value field is bytes/packets,
	// we must consider value field is actually PktDropBytes/Packets
	if slices.Contains(neededLabels, fields.PktDropLatestDropCause) || slices.Contains(neededLabels, fields.PktDropLatestState) {
		switch valueField {
		case fields.Bytes:
			valueField = fields.PktDropBytes
		case fields.Packets:
			valueField = fields.PktDropPackets
		}
	}
	for _, m := range i.metrics {
		match, missingLabels := checkMatch(&m, neededLabels, valueField, dir)
		if match {
			if m.Enabled {
				sr.Found = []string{m.Name}
				return sr
			}
			sr.Candidates = append(sr.Candidates, m.Name)
		} else if m.Enabled && len(missingLabels) > 0 {
			if sr.MissingLabels == nil {
				sr.MissingLabels = make(map[string][]string)
			}
			sr.MissingLabels[m.Name] = missingLabels
		}
	}
	log.Debugf("No metric match for %v / %s / %s", neededLabels, valueField, dir)
	return sr
}

// checkMatch checks if the metric supports the desired labels and value field. Returns true as first value if it matches.
// If it doesn't match, returns also the missing labels.
func checkMatch(metric *config.MetricInfo, neededLabels []string, valueField string, dir config.FlowDirection) (bool, []string) {
	if valueField != metric.ValueField {
		return false, nil
	}

	if dir != metric.Direction {
		return false, nil
	}

	var missingLabels []string
	for _, neededLabel := range neededLabels {
		if !slices.Contains(metric.Labels, neededLabel) {
			missingLabels = append(missingLabels, neededLabel)
		}
	}
	if len(missingLabels) > 0 {
		return false, missingLabels
	}
	return true, nil
}

func (i *Inventory) LabelExists(label string) bool {
	for _, m := range i.metrics {
		if slices.Contains(m.Labels, label) {
			return true
		}
	}
	return false
}

// FiltersToLabels converts filters to labels (extracting keys) and direction, checking for any unsupported filters. If unsupported, returns a reason as the second value
func FiltersToLabels(filts filters.SingleQuery) ([]string, string) {
	var labelsNeeded []string
	for _, m := range filts {
		if m.MoreThanOrEqual {
			// Not relevant/supported in promQL
			return nil, "MoreThan not supported in promQL"
		}
		if m.Key == fields.FlowDirection {
			// Ignore direction. Shouldn't be available in frontend filters anyway.
			continue
		}
		if !slices.Contains(labelsNeeded, m.Key) {
			labelsNeeded = append(labelsNeeded, m.Key)
		}
	}
	return labelsNeeded, ""
}
