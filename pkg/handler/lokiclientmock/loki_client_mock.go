package lokiclientmock

import (
	"encoding/json"
	neturl "net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/decoders"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/sirupsen/logrus"
)

var mlog = logrus.WithField("module", "lokiclientmock")

type LokiClientMock struct {
}

const (
	mockOlderFlowPages = 8
	mockOlderFlowDelay = 300 * time.Millisecond
)

func getMockFlowTargetTime(requestURL string) (int64, bool, error) {
	parsedURL, err := neturl.Parse(requestURL)
	if err != nil {
		return 0, false, err
	}
	params := parsedURL.Query()
	start, startErr := strconv.ParseInt(params.Get("start"), 10, 64)
	end, endErr := strconv.ParseInt(params.Get("end"), 10, 64)
	now := time.Now().Unix()
	targetTime := now - 1
	if startErr == nil && endErr == nil {
		duration := end - start
		if duration > 0 {
			page := int((now - end + duration/2) / duration)
			if page > mockOlderFlowPages {
				if page == mockOlderFlowPages+1 {
					time.Sleep(mockOlderFlowDelay)
				}
				return 0, true, nil
			}
			if page > 0 {
				time.Sleep(mockOlderFlowDelay)
			}
			targetTime = end - 1
		}
	}
	return targetTime, false, nil
}

func getLatestMockFlowTime(streams model.Streams) int64 {
	var latestTime int64
	for _, stream := range streams {
		for _, entry := range stream.Entries {
			if entry.Timestamp.Unix() > latestTime {
				latestTime = entry.Timestamp.Unix()
			}
		}
	}
	return latestTime
}

func shiftMockFlowEntry(entry *model.Entry, shiftSeconds int64) {
	entry.Timestamp = entry.Timestamp.Add(time.Duration(shiftSeconds) * time.Second)

	var fields map[string]interface{}
	if err := json.Unmarshal([]byte(entry.Line), &fields); err != nil || fields == nil {
		return
	}
	if received, ok := fields["TimeReceived"].(float64); ok {
		fields["TimeReceived"] = received + float64(shiftSeconds)
	}
	for _, field := range []string{"TimeFlowStartMs", "TimeFlowEndMs"} {
		if timestamp, ok := fields[field].(float64); ok {
			fields[field] = timestamp + float64(shiftSeconds*1000)
		}
	}
	line, err := json.Marshal(fields)
	if err == nil {
		entry.Line = string(line)
	}
}

func pageFlowRecords(data []byte, requestURL string) ([]byte, error) {
	targetTime, beyondAvailablePages, err := getMockFlowTargetTime(requestURL)
	if err != nil {
		return nil, err
	}
	if beyondAvailablePages {
		return []byte(`{"status":"success","data":{"resultType":"streams","result":[]}}`), nil
	}

	var response model.QueryResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}
	streams, ok := response.Data.Result.(model.Streams)
	if !ok {
		return data, nil
	}

	latestTime := getLatestMockFlowTime(streams)
	if latestTime == 0 {
		return data, nil
	}

	shiftSeconds := targetTime - latestTime
	for streamIndex := range streams {
		for entryIndex := range streams[streamIndex].Entries {
			shiftMockFlowEntry(&streams[streamIndex].Entries[entryIndex], shiftSeconds)
		}
	}

	return json.Marshal(response)
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
			//nolint:gocritic // if-else is ok
			if strings.Contains(url, "|~`\"Packets\":0[,}]|~`\"PktDropPackets\":[1-9][0-9]*[,}]") {
				path += "_dropped.json"
			} else if strings.Contains(url, "|~`\"PktDropPackets\":[1-9][0-9]*[,}]") {
				path += "_has_dropped.json"
			} else if strings.Contains(url, "|~`\"PktDropPackets\":0[,}]") {
				path += "_sent.json"
			} else {
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

	if strings.HasPrefix(path, "mocks/loki/flow_records") {
		file, err = pageFlowRecords(file, url)
		if err != nil {
			return nil, 500, err
		}
	}

	return []byte(file), 200, nil
}
