package lokiclientmock

import (
	"encoding/json"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	pmodel "github.com/prometheus/common/model"
)

// shiftMetricFixtureTimestamps moves matrix sample times so the latest point is near now.
func shiftMetricFixtureTimestamps(data []byte) []byte {
	var qr model.QueryResponse
	if err := json.Unmarshal(data, &qr); err != nil {
		return data
	}
	matrix, ok := qr.Data.Result.(model.Matrix)
	if !ok || len(matrix) == 0 {
		return data
	}

	var maxTS int64
	for i := range matrix {
		for _, pair := range matrix[i].Values {
			ts := int64(pair.Timestamp) / 1000
			if ts > maxTS {
				maxTS = ts
			}
		}
	}
	if maxTS == 0 {
		return data
	}

	shift := time.Now().Unix() - maxTS
	if shift == 0 {
		return data
	}

	for i := range matrix {
		for j := range matrix[i].Values {
			old := int64(matrix[i].Values[j].Timestamp) / 1000
			matrix[i].Values[j].Timestamp = pmodel.Time((old + shift) * 1000)
		}
	}
	qr.Data.Result = matrix
	out, err := json.Marshal(qr)
	if err != nil {
		return data
	}
	return out
}
