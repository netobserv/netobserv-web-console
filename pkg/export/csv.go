package export

import (
	"encoding/csv"
	"io"
)

// WriteCSV writes rows to w using the standard encoding/csv writer.
func WriteCSV(w io.Writer, rows [][]string) error {
	writer := csv.NewWriter(w)
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	writer.Flush()
	return writer.Error()
}
