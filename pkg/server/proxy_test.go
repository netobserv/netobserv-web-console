package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/stretchr/testify/require"
)

type proxyDeveloper struct{}

func (proxyDeveloper) CheckAuth(context.Context, http.Header) error { return nil }
func (proxyDeveloper) CheckAdmin(context.Context, http.Header) error {
	return errors.New("administrator required")
}

func TestProxyRecordsRequiresAdministrator(t *testing.T) {
	router := setupRoutes(context.Background(), &config.Config{}, proxyDeveloper{})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/loki/proxy/records", nil))
	require.Equal(t, http.StatusUnauthorized, w.Code)
	require.Contains(t, w.Body.String(), "administrator required")
}
