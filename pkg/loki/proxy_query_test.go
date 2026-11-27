package loki

import (
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func proxyParams(now time.Time) url.Values {
	return url.Values{"srcAddr": {"10.0.0.1"}, "srcPort": {"45678"}, "dstAddr": {"10.0.0.2"}, "dstPort": {"8080"}, "startMs": {fmtInt(now.Add(-time.Minute).UnixMilli())}, "endMs": {fmtInt(now.Add(-30 * time.Second).UnixMilli())}}
}
func fmtInt(v int64) string { return strconv.FormatInt(v, 10) }

func TestProxyQueryScopesAndBounds(t *testing.T) {
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	p := proxyParams(now)
	p.Set("cluster", `cluster" | drop SrcAddr`)
	q, err := BuildProxyQuery("http://loki:3100/", p, now, true)
	require.NoError(t, err)
	parsed, err := url.Parse(q.URL)
	require.NoError(t, err)
	logql := parsed.Query().Get("query")
	require.Contains(t, logql, `{app="netobserv-proxy",_RecordType="proxyRequest"}`)
	require.Contains(t, logql, `(SrcAddr="10.0.0.1" and SrcPort=45678 and DstAddr="10.0.0.2" and DstPort=8080)`)
	require.Contains(t, logql, `(SrcAddr="10.0.0.2" and SrcPort=8080 and DstAddr="10.0.0.1" and DstPort=45678)`)
	require.Contains(t, logql, `K8S_ClusterName="cluster\" | drop SrcAddr"`)
	require.True(t, q.Pending)
	require.Equal(t, now.UnixMilli(), q.SearchEndMs)
	old, err := BuildProxyQuery("http://loki", p, now.Add(time.Hour), true)
	require.NoError(t, err)
	require.False(t, old.Pending)
	require.Equal(t, now.Add(-30*time.Second+ProxyLookahead).UnixMilli(), old.SearchEndMs)
}

func TestProxyQueryValidation(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		key, value string
		cluster    bool
	}{
		{"srcAddr", `1.2.3.4" or true`, false}, {"dstAddr", "::%eth0", false}, {"srcPort", "0", false}, {"dstPort", "65536", false},
		{"startMs", "garbage", false}, {"endMs", "1", false}, {"cluster", "", true}, {"udn", "tenant-a", false},
	} {
		t.Run(tc.key+tc.value, func(t *testing.T) {
			p := proxyParams(now)
			p.Set(tc.key, tc.value)
			_, err := BuildProxyQuery("http://loki", p, now, tc.cluster)
			require.Error(t, err)
		})
	}
	p := proxyParams(now)
	p.Set("srcAddr", "::ffff:192.0.2.1")
	p.Set("dstAddr", "2001:db8::2")
	q, err := BuildProxyQuery("http://loki", p, now, false)
	require.NoError(t, err)
	parsed, _ := url.Parse(q.URL)
	require.True(t, strings.Contains(parsed.Query().Get("query"), `SrcAddr="192.0.2.1"`))
}
