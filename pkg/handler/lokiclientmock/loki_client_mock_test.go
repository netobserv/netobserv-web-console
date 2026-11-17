package lokiclientmock

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

func TestGetMockFlowTargetTime(t *testing.T) {
	now := time.Now().Unix()
	targetTime, beyondAvailablePages, err := getMockFlowTargetTime("http://localhost/loki/api/v1/query_range")
	if err != nil {
		t.Fatalf("getMockFlowTargetTime returned an error: %v", err)
	}
	if beyondAvailablePages {
		t.Fatal("expected latest mock page to be available")
	}
	if targetTime < now-2 || targetTime > now {
		t.Fatalf("expected target time near now, got %d", targetTime)
	}

	end := now - 20
	url := fmt.Sprintf("http://localhost/loki/api/v1/query_range?start=%d&end=%d", end-1, end)
	_, beyondAvailablePages, err = getMockFlowTargetTime(url)
	if err != nil {
		t.Fatalf("getMockFlowTargetTime returned an error: %v", err)
	}
	if !beyondAvailablePages {
		t.Fatal("expected mock pages beyond the configured history to be empty")
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
