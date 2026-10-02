package metricsexport

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExportFilenamePrefix(t *testing.T) {
	assert.Equal(t, "netobserv_metrics", ExportFilenamePrefix(""))
	assert.Equal(t, "netobserv_metrics_namespace", ExportFilenamePrefix("namespace"))
	assert.Equal(t, "netobserv_metrics_hosts_namespaces", ExportFilenamePrefix("hosts+namespaces"))
}
