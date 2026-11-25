package loki

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/lokiclientmock"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/auth"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

const (
	lokiOrgIDHeader = "X-Scope-OrgID"
)

var (
	MockProvider func() httpclient.Caller
)

type Client struct {
	httpclient.Caller
}

func NewClient(cfg *config.Loki, requestHeader http.Header, useStatusConfig, useMocks bool) Client {
	headers := map[string][]string{}
	if cfg.TenantID != "" {
		headers[lokiOrgIDHeader] = []string{cfg.TenantID}
	}

	if token, _, err := auth.RetrieveToken(requestHeader, cfg.ForwardUserToken, cfg.TokenPath); err != nil {
		log.WithError(err).Warn("Continuing without token authentication. This may cause authentication failures if the Loki server requires authentication.")
	} else if token != "" {
		headers[auth.AuthHeader] = []string{"Bearer " + token}
	}

	if useMocks {
		log.Debug("Mocking Loki Client")
		if MockProvider != nil {
			return Client{
				Caller: MockProvider(),
			}
		}
		return Client{
			Caller: new(lokiclientmock.LokiClientMock),
		}
	}

	skipTLS := cfg.SkipTLS
	caPath := cfg.CAPath
	userCertPath := ""
	userKeyPath := ""
	if useStatusConfig {
		skipTLS = cfg.StatusSkipTLS
		caPath = cfg.StatusCAPath
		userCertPath = cfg.StatusUserCertPath
		userKeyPath = cfg.StatusUserKeyPath
	}

	return Client{
		Caller: httpclient.NewClientWrapper(cfg.Timeout.Duration, headers, skipTLS, caPath, userCertPath, userKeyPath),
	}
}

/* loki query will fail if spaces or quotes are not encoded
 * we can't use url.QueryEscape or url.Values here since Loki doesn't manage encoded parenthesis
 */
func encodeQuery(url string) string {
	unquoted := strings.ReplaceAll(url, "\"", "%22")
	unspaced := strings.ReplaceAll(unquoted, " ", "%20")
	return unspaced
}

func getLokiError(resp []byte, code int) (int, *apierrors.LokiResponseError) {
	var f map[string]string
	if code == http.StatusBadRequest {
		return code, apierrors.NewLokiResponseError(code, fmt.Sprintf("Loki message: %s", resp))
	}
	if code == http.StatusForbidden {
		return code, apierrors.NewLokiResponseError(code, fmt.Sprintf("Forbidden: %s", resp))
	}
	err := json.Unmarshal(resp, &f)
	if err != nil {
		log.WithError(err).Errorf("cannot unmarshal, response was: %v", string(resp))
		return code, apierrors.NewLokiResponseError(code, fmt.Sprintf("Unknown error from Loki\ncannot unmarshal\n%s", resp))
	}
	message, ok := f["error"]
	if !ok {
		message, ok = f["message"]
		if !ok {
			log.WithError(err).Errorf("unknown Loki error: %v", f)
			return http.StatusServiceUnavailable, apierrors.NewLokiResponseError(code, "Unknown error from Loki")
		}
	}
	return http.StatusServiceUnavailable, apierrors.NewLokiResponseError(code, fmt.Sprintf("Loki message: %s", message))
}

func (c *Client) Fetch(query string) (model.QueryResponse, int, apierrors.StructuredError) {
	var qr model.QueryResponse
	resp, code, err := c.RawFetch(query)
	if err != nil {
		return qr, code, err
	}
	if err := json.Unmarshal(resp, &qr); err != nil {
		log.WithError(err).Errorf("cannot unmarshal, response was: %v", string(resp))
		return qr, http.StatusInternalServerError, apierrors.NewLokiClientError(err)
	}
	return qr, code, nil
}

func (c *Client) RawFetch(query string) ([]byte, int, apierrors.StructuredError) {
	log.Debugf("Fetching: %s", query)
	var code int
	startTime := time.Now()
	defer func() {
		metrics.ObserveLokiCall(code, startTime)
	}()

	resp, code, err := c.Get(query)
	if err != nil {
		return nil, http.StatusServiceUnavailable, apierrors.NewLokiClientError(err)
	}
	if code != http.StatusOK {
		newCode, err := getLokiError(resp, code)
		log.Debugf("Fetch error: %s", err.Error())
		return nil, newCode, err
	}
	return resp, http.StatusOK, nil
}

func (c *Client) GetLabelValues(baseURL string, label string) ([]string, int, apierrors.StructuredError) {
	baseURL = strings.TrimRight(baseURL, "/")
	url := fmt.Sprintf("%s/loki/api/v1/label/%s/values", baseURL, label)
	log.Debugf("GetLabelValues URL: %s", url)

	resp, code, err := c.Get(url)
	if err != nil {
		return nil, http.StatusServiceUnavailable, apierrors.NewLokiClientError(fmt.Errorf("error while fetching label %s values from Loki: [%d] %w", label, code, err))
	}
	if code != http.StatusOK {
		newCode, err := getLokiError(resp, code)
		log.Debugf("GetLabelValues error: %s", err.Error())
		return nil, newCode, err
	}
	log.Tracef("GetLabelValues raw response: %s", resp)
	var lvr model.LabelValuesResponse
	err = json.Unmarshal(resp, &lvr)
	if err != nil {
		return nil, http.StatusInternalServerError, apierrors.NewLokiClientError(fmt.Errorf("unmarshal error while fetching label %s values from Loki: %w", label, err))
	}
	return lvr.Data, http.StatusOK, nil
}
