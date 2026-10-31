package metricsexport

import "github.com/netobserv/network-observability-console-plugin/pkg/export"

const metricsExportBasePrefix = "netobserv_metrics"

// ExportFilenamePrefix returns the download filename prefix for a metrics export.
func ExportFilenamePrefix(metricScope string) string {
	scope := export.SanitizeFilenamePart(metricScope)
	if scope == "" {
		return metricsExportBasePrefix
	}
	return metricsExportBasePrefix + "_" + scope
}
