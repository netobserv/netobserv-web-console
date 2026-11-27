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

	response := model.QueryResponse{
		Status: "success",
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeStream,
			Result: model.Streams{{
				Labels: map[string]string{"app": "test"},
				Entries: []model.Entry{{
					Timestamp: time.Unix(now-120, 0),
					Line:      fmt.Sprintf(`{"TimeReceived":%d}`, now-120),
				}},
			}},
		},
	}
	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal mock Loki response: %v", err)
	}
	countEntries := func(t *testing.T, result []byte) []model.Entry {
		t.Helper()
		var parsed model.QueryResponse
		if err := json.Unmarshal(result, &parsed); err != nil {
			t.Fatalf("failed to decode mock Loki response: %v", err)
		}
		streams, ok := parsed.Data.Result.(model.Streams)
		if !ok {
			t.Fatalf("expected streams response, got %T", parsed.Data.Result)
		}
		var entries []model.Entry
		for _, stream := range streams {
			entries = append(entries, stream.Entries...)
		}
		return entries
	}

	end := now - int64((mockOlderFlowPages+2)*mockOlderFlowPageDuration/time.Second)
	url := fmt.Sprintf("http://localhost/loki/api/v1/query_range?start=%d&end=%d", end-60, end)
	firstPage, err := pageFlowRecordsAt(data, url, referenceTime)
	if err != nil {
		t.Fatalf("pageFlowRecords returned an error: %v", err)
	}
	if entries := countEntries(t, firstPage); len(entries) != 0 {
		t.Fatalf("expected the first out-of-history page to be empty, got %d entries", len(entries))
	}

	widenedURL := fmt.Sprintf("http://localhost/loki/api/v1/query_range?start=%d&end=%d", end-3600, end)
	widenedPage, err := pageFlowRecordsAt(data, widenedURL, referenceTime)
	if err != nil {
		t.Fatalf("pageFlowRecords returned an error for a widened window: %v", err)
	}
	if entries := countEntries(t, widenedPage); len(entries) != 0 {
		t.Fatalf("expected the widened out-of-history page to remain empty, got %d entries", len(entries))
	}

	availableEnd := now - 60
	availableURL := fmt.Sprintf("http://localhost/loki/api/v1/query_range?start=%d&end=%d", availableEnd-60, availableEnd)
	availablePage, err := pageFlowRecordsAt(data, availableURL, referenceTime)
	if err != nil {
		t.Fatalf("pageFlowRecords returned an error for an available window: %v", err)
	}
	entries := countEntries(t, availablePage)
	if len(entries) != 1 {
		t.Fatalf("expected the available window to return its entry, got %d entries", len(entries))
	}
	if got := entries[0].Timestamp.Unix(); got != availableEnd-1 {
		t.Fatalf("expected available entry timestamp %d, got %d", availableEnd-1, got)
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
