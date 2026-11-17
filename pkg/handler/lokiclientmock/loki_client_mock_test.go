package lokiclientmock

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

func TestGetMockFlowTargetTime(t *testing.T) {
	referenceTime := time.Unix(1_700_000_000, 0)
	now := referenceTime.Unix()
	targetTime, beyondAvailablePages, err := getMockFlowTargetTimeAt("http://localhost/loki/api/v1/query_range", referenceTime)
	if err != nil {
		t.Fatalf("getMockFlowTargetTime returned an error: %v", err)
	}
	if beyondAvailablePages {
		t.Fatal("expected latest mock page to be available")
	}
	if targetTime < now-2 || targetTime > now {
		t.Fatalf("expected target time near now, got %d", targetTime)
	}

	end := now - int64((mockOlderFlowPages+2)*mockOlderFlowPageDuration/time.Second)
	url := fmt.Sprintf("http://localhost/loki/api/v1/query_range?start=%d&end=%d", end-60, end)
	firstPage, err := pageFlowRecordsAt([]byte(`{"status":"success","data":{"resultType":"streams","result":[]}}`), url, referenceTime)
	if err != nil {
		t.Fatalf("pageFlowRecords returned an error: %v", err)
	}
	if string(firstPage) != `{"status":"success","data":{"resultType":"streams","result":[]}}` {
		t.Fatalf("expected the first out-of-history page to be empty, got %s", firstPage)
	}

	widenedURL := fmt.Sprintf("http://localhost/loki/api/v1/query_range?start=%d&end=%d", end-3600, end)
	widenedPage, err := pageFlowRecordsAt([]byte(`{"status":"success","data":{"resultType":"streams","result":[]}}`), widenedURL, referenceTime)
	if err != nil {
		t.Fatalf("pageFlowRecords returned an error for a widened window: %v", err)
	}
	if string(widenedPage) != string(firstPage) {
		t.Fatalf("expected widening an empty page to keep it empty, got %s", widenedPage)
	}
}

func TestShiftMockFlowEntry(t *testing.T) {
	entry := model.Entry{
		Timestamp: time.Unix(100, 0),
		Line:      `{"TimeReceived":100,"TimeFlowStartMs":90000,"TimeFlowEndMs":99000}`,
	}
	shiftMockFlowEntry(&entry, 5)

	var fields map[string]float64
	if err := json.Unmarshal([]byte(entry.Line), &fields); err != nil {
		t.Fatalf("failed to decode shifted flow fields: %v", err)
	}
	if got := entry.Timestamp.Unix(); got != 105 {
		t.Errorf("expected shifted entry timestamp 105, got %d", got)
	}
	if got := fields["TimeReceived"]; got != 105 {
		t.Errorf("expected TimeReceived 105, got %v", got)
	}
	if got := fields["TimeFlowStartMs"]; got != 95000 {
		t.Errorf("expected TimeFlowStartMs 95000, got %v", got)
	}
	if got := fields["TimeFlowEndMs"]; got != 104000 {
		t.Errorf("expected TimeFlowEndMs 104000, got %v", got)
	}
}
