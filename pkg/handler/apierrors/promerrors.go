package apierrors

import (
	"fmt"
	"strings"
)

// PromClientError is used when there is a client error while querying Prometheus, either on our side, or in the HTTP connection
type PromClientError struct {
	StructuredError `json:"-"`
	PromClient      bool   `json:"promClient,omitempty"`
	Message         string `json:"message,omitempty"`
}

func NewPromClientError(err error) *PromClientError {
	return &PromClientError{PromClient: true, Message: err.Error()}
}

func (e *PromClientError) Error() string {
	return e.Message
}

type PromUnsupportedError struct {
	StructuredError `json:"-"`
	PromUnsupported bool   `json:"promUnsupported,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

func NewPromUnsupported(reason string) *PromUnsupportedError {
	return &PromUnsupportedError{PromUnsupported: true, Reason: reason}
}

func (e *PromUnsupportedError) Error() string {
	var reason string
	if e.Reason != "" {
		reason = fmt.Sprintf(" (reason: %s)", e.Reason)
	}
	return fmt.Sprintf("This request could not be performed with Prometheus metrics%s: it requires installing and enabling Loki", reason)
}

type PromDisabledMetricsError struct {
	StructuredError     `json:"-"`
	PromDisabledMetrics bool     `json:"promDisabledMetrics,omitempty"`
	Candidates          []string `json:"candidates,omitempty"`
}

func NewPromDisabledMetrics(candidates []string) *PromDisabledMetricsError {
	var names []string
	for _, m := range candidates {
		names = append(names,
			strings.TrimPrefix(
				strings.TrimSuffix(m, "_count"),
				"netobserv_",
			),
		)
	}
	return &PromDisabledMetricsError{PromDisabledMetrics: true, Candidates: names}
}

func (e *PromDisabledMetricsError) Error() string {
	return fmt.Sprintf("the query requires some metrics to be enabled: %s", strings.Join(e.Candidates, ", "))
}

type PromMissingLabelsError struct {
	StructuredError   `json:"-"`
	PromMissingLabels bool                `json:"promMissingLabels,omitempty"`
	Missing           map[string][]string `json:"missing,omitempty"`
}

func NewPromMissingLabels(missing map[string][]string) *PromMissingLabelsError {
	return &PromMissingLabelsError{PromMissingLabels: true, Missing: missing}
}

func (e *PromMissingLabelsError) Error() string {
	var smallestSet []string
	for _, labels := range e.Missing {
		if smallestSet == nil || len(smallestSet) > len(labels) {
			smallestSet = labels
		}
	}
	return fmt.Sprintf("some requested labels are missing in Prometheus metrics: %s", strings.Join(smallestSet, ", "))
}
