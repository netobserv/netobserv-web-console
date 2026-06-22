package loki

import (
	"github.com/netobserv/network-observability-console-plugin/pkg/merger"
)

// MatrixMerger is an alias for merger.MatrixMerger for backwards compatibility within this package.
// New code should use merger.MatrixMerger directly.
type MatrixMerger = merger.MatrixMerger

// NewMatrixMerger creates a new MatrixMerger with the given per-query result limit.
func NewMatrixMerger(reqLimit int) *MatrixMerger {
	return merger.NewMatrixMerger(reqLimit)
}
