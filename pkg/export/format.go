package export

import "fmt"

const (
	FormatJSON = "json"
	FormatCSV  = "csv"

	FormatKey = "format"
)

// ParseFormat returns a validated export format. Empty raw uses defaultFormat.
func ParseFormat(raw, defaultFormat string) (string, error) {
	if raw == "" {
		raw = defaultFormat
	}
	switch raw {
	case FormatJSON, FormatCSV:
		return raw, nil
	default:
		return "", fmt.Errorf("export format %q is not valid", raw)
	}
}
