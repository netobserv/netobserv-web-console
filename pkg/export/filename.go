package export

import (
	"fmt"
	"strings"
	"time"
	"unicode"
)

// Filename returns a timestamped download filename.
func Filename(prefix, extension string) string {
	stamp := time.Now().UTC().Format("20060102_150405")
	return fmt.Sprintf("%s_%s.%s", prefix, stamp, extension)
}

// SanitizeFilenamePart normalizes a string for use in download filenames.
func SanitizeFilenamePart(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range value {
		switch {
		case unicode.IsLetter(r), unicode.IsDigit(r):
			b.WriteRune(r)
		case r == '-', r == '_':
			b.WriteRune(r)
		case r == '+':
			b.WriteRune('_')
		default:
			b.WriteRune('_')
		}
	}
	return strings.Trim(b.String(), "_")
}
