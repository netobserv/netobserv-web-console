package loki

import (
	"fmt"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const ProxyResultLimit = 1000
const ProxyLookahead = 10 * time.Minute
const proxyClockSkew = 2 * time.Second

// ProxyQuery bounds a historical lookup by both reception time and request overlap.
// Logs arrive at request completion; the lookahead is explicit and cannot prove absence.
type ProxyQuery struct {
	URL           string
	SearchStartMs int64
	SearchEndMs   int64
	Pending       bool
}

func BuildProxyQuery(baseURL string, params url.Values, now time.Time, requireCluster bool) (ProxyQuery, error) {
	var result ProxyQuery
	if params.Get("udn") != "" {
		return result, fmt.Errorf("proxy correlation does not support user-defined networks")
	}
	var addresses [2]string
	var ports [2]uint64
	for i, side := range []string{"src", "dst"} {
		addr, err := netip.ParseAddr(params.Get(side + "Addr"))
		if err != nil || addr.IsUnspecified() || addr.Zone() != "" {
			return result, fmt.Errorf("invalid %s address", side)
		}
		addresses[i] = addr.Unmap().String()
		ports[i], err = strconv.ParseUint(params.Get(side+"Port"), 10, 16)
		if err != nil || ports[i] == 0 {
			return result, fmt.Errorf("invalid %s port", side)
		}
	}
	start, err := strconv.ParseInt(params.Get("startMs"), 10, 64)
	if err != nil {
		return result, fmt.Errorf("invalid flow start time")
	}
	end, err := strconv.ParseInt(params.Get("endMs"), 10, 64)
	if err != nil || start <= proxyClockSkew.Milliseconds() || end < start || end-start > (24*time.Hour).Milliseconds() || end > now.Add(proxyClockSkew).UnixMilli() {
		return result, fmt.Errorf("invalid flow interval (maximum 24 hours)")
	}
	cluster := params.Get("cluster")
	if len(cluster) > 253 || (requireCluster && cluster == "") {
		return result, fmt.Errorf("a cluster identity is required for multi-cluster correlation")
	}
	tuple := func(a, b int) string {
		return fmt.Sprintf("(SrcAddr=%q and SrcPort=%d and DstAddr=%q and DstPort=%d)", addresses[a], ports[a], addresses[b], ports[b])
	}
	query := `{app="netobserv-proxy",_RecordType="proxyRequest"} | json | __error__="" | ProxySchemaVersion=1 | Proto=6 | (` + tuple(0, 1) + " or " + tuple(1, 0) + ")"
	query += fmt.Sprintf(" | ProxyStartMs<=%d and ProxyEndMs>=%d", end+proxyClockSkew.Milliseconds(), start-proxyClockSkew.Milliseconds())
	if cluster != "" {
		query += fmt.Sprintf(" | K8S_ClusterName=%q", cluster)
	}
	// Reject numeric conversion errors produced by any preceding filter.
	query += ` | __error__=""`
	result.SearchStartMs = start - proxyClockSkew.Milliseconds()
	coverageEnd := time.UnixMilli(end).Add(ProxyLookahead)
	result.Pending = now.Before(coverageEnd)
	if result.Pending {
		coverageEnd = now
	}
	result.SearchEndMs = coverageEnd.UnixMilli()
	values := url.Values{"query": {query}, "start": {strconv.FormatInt(result.SearchStartMs*int64(time.Millisecond), 10)}, "end": {strconv.FormatInt(result.SearchEndMs*int64(time.Millisecond), 10)}, "limit": {strconv.Itoa(ProxyResultLimit)}, "direction": {"forward"}}
	result.URL = strings.TrimRight(baseURL, "/") + "/loki/api/v1/query_range?" + values.Encode()
	return result, nil
}
