package lokiclientmock

import (
	"encoding/json"
	"os"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/decoders"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/sirupsen/logrus"
)

var mlog = logrus.WithField("module", "lokiclientmock")

type LokiClientMock struct {
}

//nolint:cyclop
func (o *LokiClientMock) Get(url string) ([]byte, int, error) {
	var path string
	parseNetEvents := false
	mlog.Debugf("Get url: %s", url)

	isLabel := strings.Contains(url, "/label/")
	if isLabel {
		path = "mocks/loki/namespaces.json"
	} else {
		if strings.Contains(url, "query=topk") || strings.Contains(url, "query=bottomk") {
			// Simulate error for packet rate metrics (non-dropped packets)
			if strings.Contains(url, "unwrap%20Packets") && !strings.Contains(url, "|unwrap%20PktDrop") {
				errorResponse := []byte(`{
					"status": "error",
					"errorType": "timeout",
					"error": "context deadline exceeded: query timed out"
				}`)
				return errorResponse, 500, nil
			}

			// Simulate error for DNS Name metrics
			if strings.Contains(url, "by(DnsName)") {
				errorResponse := []byte(`{
					"status": "error",
					"errorType": "bad_data",
					"error": "parse error: label name \"DnsName\" must match regex [a-zA-Z_][a-zA-Z0-9_]*"
				}`)
				return errorResponse, 400, nil
			}

			// Simulate error for RTT metrics
			if strings.Contains(url, "unwrap%20TimeFlowRttNs") {
				errorResponse := []byte(`{
					"status": "error",
					"errorType": "timeout",
					"error": "maximum of series (50000) reached for a single query"
				}`)
				return errorResponse, 500, nil
			}

			path = "mocks/loki/flow_metrics"

			if strings.Contains(url, "|unwrap%20PktDrop") {
				path += "_dropped"
			}

			//nolint:gocritic // if-else is ok
			if strings.Contains(url, "by(app)") {
				path += "_app.json"
			} else if strings.Contains(url, "by(PktDropLatestState)") {
				path += "_state.json"
			} else if strings.Contains(url, "by(PktDropLatestDropCause)") {
				path += "_cause.json"
			} else if strings.Contains(url, "by(K8S_ClusterName)") {
				path += "_cluster.json"
			} else if strings.Contains(url, "by(SrcK8S_NetworkName,DstK8S_NetworkName)") {
				path += "_udn.json"
			} else if strings.Contains(url, "by(SrcK8S_Zone,DstK8S_Zone)") {
				path += "_zone.json"
			} else if strings.Contains(url, "by(SrcK8S_HostName,DstK8S_HostName)") {
				path += "_host.json"
			} else if strings.Contains(url, "by(SrcK8S_Namespace,DstK8S_Namespace)") {
				path += "_namespace.json"
			} else if strings.Contains(url, "by(SrcK8S_OwnerName,SrcK8S_OwnerType,DstK8S_OwnerName,DstK8S_OwnerType,SrcK8S_Namespace,DstK8S_Namespace)") {
				path += "_owner.json"
			} else {
				path += "_resource.json"
			}
		} else {
			path = "mocks/loki/flow_records"
			// Match pkg/loki/flow_query.go packetLoss filters (order matters).
			switch {
			case strings.Contains(url, "!~`\"Packets\"`") && strings.Contains(url, "|~`\"PktDropPackets\":[1-9]"):
				path += "_dropped.json"
			case strings.Contains(url, "|~`\"PktDropPackets\":[1-9]"):
				path += "_has_dropped.json"
			case strings.Contains(url, "!~`\"PktDropPackets\"`"):
				path += "_sent.json"
			default:
				path += ".json"
				parseNetEvents = true
			}
		}
	}

	mlog.Debugf("Reading file path: %s", path)
	file, err := os.ReadFile(path)
	if err != nil {
		// If dropped file doesn't exist, try falling back to non-dropped version
		if strings.Contains(path, "_dropped") {
			fallbackPath := strings.Replace(path, "_dropped", "", 1)
			mlog.Debugf("Dropped file not found, trying fallback: %s", fallbackPath)
			file, err = os.ReadFile(fallbackPath)
			if err == nil {
				mlog.Debugf("Using fallback file: %s", fallbackPath)
			}
		}
		// If still error (or not a dropped file), return empty response
		if err != nil {
			emptyResponse := []byte(`{
				"status": "success",
				"data": {
					"resultType": "matrix",
					"result": []
				}
			}`)

			var qr model.QueryResponse
			err = json.Unmarshal(emptyResponse, &qr)
			if err != nil {
				return nil, 500, err
			}
			for _, s := range qr.Data.Result.(model.Streams) {
				for i := range s.Entries {
					s.Entries[i].Line = decoders.NetworkEventsToString(s.Entries[i].Line)
				}
			}
			emptyResponse, err = json.Marshal(qr)
			if err != nil {
				return nil, 500, err
			}
			return emptyResponse, 200, nil
		}
	}

	if parseNetEvents {
		var qr model.QueryResponse
		err = json.Unmarshal(file, &qr)
		if err != nil {
			return nil, 500, err
		}
		for _, s := range qr.Data.Result.(model.Streams) {
			for i := range s.Entries {
				s.Entries[i].Line = decoders.NetworkEventsToString(s.Entries[i].Line)
			}
		}
		file, err = json.Marshal(qr)
		if err != nil {
			return nil, 500, err
		}
	}

	if strings.Contains(path, "flow_metrics") {
		file = shiftMetricFixtureTimestamps(file)
	}

	return []byte(file), 200, nil
}
