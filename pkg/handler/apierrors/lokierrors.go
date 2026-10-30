package apierrors

import (
	"fmt"
)

type DatasourceDisabledError struct {
	StructuredError    `json:"-"`
	DatasourceDisabled bool   `json:"datasourceDisabled,omitempty"`
	Message            string `json:"message,omitempty"`
}

func NewDatasourceDisabledError(message string) *DatasourceDisabledError {
	return &DatasourceDisabledError{DatasourceDisabled: true, Message: message}
}

func (e *DatasourceDisabledError) Error() string {
	return e.Message
}

type LokiResponseError struct {
	StructuredError `json:"-"`
	LokiResponse    bool   `json:"lokiResponse,omitempty"`
	Message         string `json:"message,omitempty"`
}

// NewLokiResponseError is used when the HTTP call made it to Loki and returned an error
func NewLokiResponseError(code int, message string) *LokiResponseError {
	return &LokiResponseError{LokiResponse: true, Message: fmt.Sprintf("Error from Loki: [%d] %s", code, message)}
}

func (e *LokiResponseError) Error() string {
	return e.Message
}

// LokiClientError is used when there is a client error while querying Loki, either on our side, or in the HTTP connection
type LokiClientError struct {
	StructuredError `json:"-"`
	LokiClient      bool   `json:"lokiClient,omitempty"`
	Message         string `json:"message,omitempty"`
}

func NewLokiClientError(err error) *LokiClientError {
	return &LokiClientError{LokiClient: true, Message: err.Error()}
}

func (e *LokiClientError) Error() string {
	return e.Message
}
