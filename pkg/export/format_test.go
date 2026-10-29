package export

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseFormat(t *testing.T) {
	got, err := ParseFormat("", FormatCSV)
	require.NoError(t, err)
	assert.Equal(t, FormatCSV, got)

	got, err = ParseFormat("json", FormatCSV)
	require.NoError(t, err)
	assert.Equal(t, FormatJSON, got)

	got, err = ParseFormat("csv", FormatJSON)
	require.NoError(t, err)
	assert.Equal(t, FormatCSV, got)

	_, err = ParseFormat("xml", FormatCSV)
	require.Error(t, err)
}
