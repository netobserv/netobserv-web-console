package handler

import (
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/stretchr/testify/assert"
)

func TestGetStartTime(t *testing.T) {
	now := time.Now().Unix()

	// Valid
	params := url.Values{
		startTimeKey: []string{strconv.FormatInt(now, 10)},
	}
	st, err := getStartTime(params)
	assert.NoError(t, err)
	assert.Equal(t, now, st.Unix())

	// Invalid
	params = url.Values{
		startTimeKey: []string{"invalid"},
	}
	_, err = getStartTime(params)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Could not parse start time")
}

func TestGetEndTime(t *testing.T) {
	now := time.Now().Unix()

	// Valid
	params := url.Values{
		endTimeKey: []string{strconv.FormatInt(now, 10)},
	}
	et, err := getEndTime(params)
	assert.NoError(t, err)
	assert.Equal(t, now+1, et.Unix())

	// Invalid
	params = url.Values{
		endTimeKey: []string{"invalid"},
	}
	_, err = getEndTime(params)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Could not parse end time")
}

func TestGetRecordType(t *testing.T) {
	// Valid
	params := url.Values{
		recordTypeKey: []string{"heartbeat"},
	}
	rec, err := getRecordType(params)
	assert.NoError(t, err)
	assert.Equal(t, constants.RecordTypeHeartbeat, rec)

	// Invalid
	params = url.Values{
		recordTypeKey: []string{"invalid"},
	}
	_, err = getRecordType(params)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid record type")

	// Default
	params = url.Values{}
	rec, err = getRecordType(params)
	assert.NoError(t, err)
	assert.Equal(t, constants.DefaultRecordType, rec)
}

func TestGetMetricType(t *testing.T) {
	// Valid
	params := url.Values{
		metricTypeKey: []string{"Packets"},
	}
	m := getMetricType(params)
	assert.Equal(t, constants.MetricTypePackets, m)

	// Default
	params = url.Values{}
	m = getMetricType(params)
	assert.Equal(t, constants.DefaultMetricType, m)
}

func TestGetPacketLoss(t *testing.T) {
	// Valid
	params := url.Values{
		packetLossKey: []string{"dropped"},
	}
	pl, err := getPacketLoss(params)
	assert.NoError(t, err)
	assert.Equal(t, constants.PacketLossDropped, pl)

	// Invalid
	params = url.Values{
		packetLossKey: []string{"invalid"},
	}
	_, err = getPacketLoss(params)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid packet loss")

	// Default
	params = url.Values{}
	pl, err = getPacketLoss(params)
	assert.NoError(t, err)
	assert.Equal(t, constants.DefaultPacketLoss, pl)
}

func TestGetRateInterval(t *testing.T) {
	// Valid
	params := url.Values{
		rateIntervalKey: []string{"5m"},
	}
	ri, err := getRateInterval(params)
	assert.NoError(t, err)
	assert.Equal(t, "5m", ri)

	// Invalid
	params = url.Values{
		rateIntervalKey: []string{"invalid"},
	}
	_, err = getRateInterval(params)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid rate interval")

	// Default
	params = url.Values{}
	ri, err = getRateInterval(params)
	assert.NoError(t, err)
	assert.Equal(t, defaultRateInterval, ri)
}

func TestGetStep(t *testing.T) {
	// Valid
	params := url.Values{
		stepKey: []string{"10s"},
	}
	sd, err := getStep(params)
	assert.NoError(t, err)
	assert.Equal(t, 10*time.Second, sd)

	// Invalid
	params = url.Values{
		stepKey: []string{"invalid"},
	}
	_, err = getStep(params)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid step")

	// Default
	params = url.Values{}
	sd, err = getStep(params)
	assert.NoError(t, err)
	assert.Equal(t, defaultStepDuration, sd)
}
