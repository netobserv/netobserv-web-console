package handler

import (
	"encoding/json"
	"net/http"

	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
)

func writeText(w http.ResponseWriter, code int, bytes []byte) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(code)
	_, err := w.Write(bytes)
	if err != nil {
		hlog.Errorf("Error while responding Text: %v", err)
	}
}

func writeJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		hlog.Errorf("Marshalling error while responding JSON: %v", err)
		apierrors.Write(w, http.StatusInternalServerError, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, err = w.Write(response)
	if err != nil {
		hlog.Errorf("Error while responding JSON: %v", err)
	}
}
