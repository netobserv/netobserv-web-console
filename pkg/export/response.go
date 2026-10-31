package export

import (
	"encoding/json"
	"io"
	"net/http"
)

// SetAttachmentHeaders configures download response headers.
func SetAttachmentHeaders(w http.ResponseWriter, prefix, extension, contentType string) {
	w.Header().Set("Content-Disposition", "attachment; filename="+Filename(prefix, extension))
	w.Header().Set("Content-Type", contentType)
}

// WriteJSON writes a JSON attachment response.
func WriteJSON(w http.ResponseWriter, code int, prefix string, payload interface{}) error {
	SetAttachmentHeaders(w, prefix, FormatJSON, "application/json")
	w.WriteHeader(code)
	return json.NewEncoder(w).Encode(payload)
}

// WriteCSVAttachment writes a CSV attachment response.
func WriteCSVAttachment(w http.ResponseWriter, code int, prefix string, rows [][]string) error {
	SetAttachmentHeaders(w, prefix, FormatCSV, "text/csv")
	w.Header().Set("Transfer-Encoding", "chunked")
	w.WriteHeader(code)
	return WriteCSV(w, rows)
}

// WriteCSVTo writes CSV rows to an existing writer (no HTTP headers).
func WriteCSVTo(w io.Writer, rows [][]string) error {
	return WriteCSV(w, rows)
}
