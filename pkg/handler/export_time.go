package handler

import (
	"encoding/json"
	"net/url"
	"strconv"
)

func encodeExportTimeRangeFromParams(params url.Values) (json.RawMessage, error) {
	if tr := params.Get(timeRangeKey); tr != "" {
		parsed, err := strconv.ParseInt(tr, 10, 64)
		if err != nil {
			return json.Marshal(tr)
		}
		return json.Marshal(parsed)
	}
	start := params.Get(startTimeKey)
	end := params.Get(endTimeKey)
	if start != "" {
		return json.Marshal(map[string]string{"from": start, "to": end})
	}
	return json.Marshal(nil)
}

func encodeExportTimeRange(timeRange int64, startTime, endTime string) (json.RawMessage, error) {
	if timeRange > 0 {
		return json.Marshal(timeRange)
	}
	if startTime != "" {
		return json.Marshal(map[string]string{"from": startTime, "to": endTime})
	}
	return json.Marshal(nil)
}
