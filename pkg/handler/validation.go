package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

func getStartTime(params url.Values) (time.Time, error) {
	start := params.Get(startTimeKey)
	var sTime time.Time
	if len(start) == 0 {
		tr := params.Get(timeRangeKey)
		if len(tr) > 0 {
			r, err := strconv.ParseInt(tr, 10, 64)
			if err != nil {
				return sTime, errors.New("Could not parse time range: " + err.Error())
			}
			sTime = time.Now().Add(-time.Second * time.Duration(r))
		}
	} else {
		// Make sure it is a valid int
		s, err := strconv.ParseInt(start, 10, 64)
		if err != nil {
			return sTime, errors.New("Could not parse start time: " + err.Error())
		}
		sTime = time.Unix(s, 0)
	}
	return sTime, nil
}

// getEndTime will parse end time and ceil it to the next second
func getEndTime(params url.Values) (time.Time, error) {
	end := params.Get(endTimeKey)
	var eTime time.Time
	if len(end) == 0 {
		return eTime, nil
	}
	r, err := strconv.ParseInt(end, 10, 64)
	if err != nil {
		return eTime, errors.New("Could not parse end time: " + err.Error())
	}
	return time.Unix(r+1, 0), nil
}

// getLimit returns limit parsed as int
func getLimit(params url.Values) (int, error) {
	limit := params.Get(limitKey)
	var reqLimit int
	if len(limit) > 0 {
		l, err := strconv.ParseInt(limit, 10, 64)
		if err != nil {
			return 0, errors.New("Could not parse limit: " + err.Error())
		}
		reqLimit = int(l)
	}
	return reqLimit, nil
}

func getRecordType(params url.Values) (constants.RecordType, error) {
	rt := params.Get(recordTypeKey)
	if rt == "" {
		return constants.DefaultRecordType, nil
	}
	recordType := constants.RecordType(rt)
	if recordType == constants.RecordTypeAllConnections ||
		recordType == constants.RecordTypeEndConnection ||
		recordType == constants.RecordTypeHeartbeat ||
		recordType == constants.RecordTypeLog ||
		recordType == constants.RecordTypeNewConnection {
		return recordType, nil
	}
	return "", fmt.Errorf("invalid record type: %s", rt)
}

func getDatasource(params url.Values) (constants.DataSource, error) {
	ds := params.Get(dataSourceKey)
	if ds == "" {
		return constants.DefaultDataSource, nil
	}
	dataSource := constants.DataSource(ds)
	if dataSource == constants.DataSourceAuto ||
		dataSource == constants.DataSourceLoki ||
		dataSource == constants.DataSourceProm {
		return dataSource, nil
	}
	return "", fmt.Errorf("invalid data source: %s", ds)
}

func getPacketLoss(params url.Values) (constants.PacketLoss, error) {
	pl := params.Get(packetLossKey)
	if pl == "" {
		return constants.DefaultPacketLoss, nil
	}
	packetLoss := constants.PacketLoss(pl)
	if packetLoss == constants.PacketLossAll ||
		packetLoss == constants.PacketLossDropped ||
		packetLoss == constants.PacketLossHasDrop ||
		packetLoss == constants.PacketLossSent {
		return packetLoss, nil
	}
	return "", fmt.Errorf("invalid packet loss: %s", pl)
}

func getAggregate(params url.Values) (string, error) {
	agg := params.Get(aggregateByKey)
	if agg == "" {
		return "", errors.New("aggregateBy parameter is required")
	}
	return agg, nil
}

func getMetricType(params url.Values) string {
	mt := params.Get(metricTypeKey)
	if mt == "" {
		return constants.DefaultMetricType
	}
	return mt
}

func getMetricFunction(params url.Values) (constants.MetricFunction, error) {
	mf := params.Get(metricFunctionKey)
	if mf == "" {
		return constants.DefaultMetricFunction, nil
	}
	metricFunction := constants.MetricFunction(mf)
	if metricFunction == constants.MetricFunctionCount ||
		metricFunction == constants.MetricFunctionSum ||
		metricFunction == constants.MetricFunctionAvg ||
		metricFunction == constants.MetricFunctionMin ||
		metricFunction == constants.MetricFunctionMax ||
		metricFunction == constants.MetricFunctionP90 ||
		metricFunction == constants.MetricFunctionP99 ||
		metricFunction == constants.MetricFunctionRate {
		return metricFunction, nil
	}
	return "", fmt.Errorf("invalid metric function: %s", mf)
}

func getRateInterval(params url.Values) (string, error) {
	rateInterval := params.Get(rateIntervalKey)
	if rateInterval == "" {
		return defaultRateInterval, nil
	}
	if _, err := time.ParseDuration(rateInterval); err != nil {
		return "", fmt.Errorf("invalid rate interval %s: %w", rateInterval, err)
	}
	return rateInterval, nil
}

func getStep(params url.Values) (time.Duration, error) {
	step := params.Get(stepKey)
	if step == "" {
		return defaultStepDuration, nil
	}
	d, err := time.ParseDuration(step)
	if err != nil {
		return 0, fmt.Errorf("invalid step %s: %w", step, err)
	}
	return d, nil
}

func getQueryContext(r *http.Request) (*backend.QueryContext, error) {
	params := r.URL.Query()
	tenant := params.Get(tenantKey)

	ds, err := getDatasource(params)
	if err != nil {
		return nil, err
	}

	return &backend.QueryContext{
		DataSource:    ds,
		RequestHeader: r.Header,
		Tenant:        tenant,
	}, nil
}
