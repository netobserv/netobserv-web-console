package prometheus

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/auth"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	pconf "github.com/prometheus/common/config"
	pmod "github.com/prometheus/common/model"
)

type Client struct {
	api.Client
}

func NewAdminClient(cfg *config.Prometheus, requestHeader http.Header) (*Client, error) {
	return newClient(cfg.Timeout.Duration, cfg.SkipTLS, cfg.CAPath, cfg.ForwardUserToken, cfg.TokenPath, cfg.URL, requestHeader)
}

func NewTenantClient(cfg *config.Prometheus, requestHeader http.Header, namespace string) (*Client, error) {
	var url string
	if cfg.DevURL == "" {
		url = cfg.URL
	} else {
		url = fmt.Sprintf("%s?namespace=%s", cfg.DevURL, namespace)
	}
	return newClient(cfg.Timeout.Duration, cfg.SkipTLS, cfg.CAPath, cfg.ForwardUserToken, cfg.TokenPath, url, requestHeader)
}

func newClient(timeout time.Duration, skipTLS bool, caPath string, forwardUserToken bool, tokenPath string, url string, requestHeader http.Header) (*Client, error) {
	roundTripper, err := CreateRoundTripper(timeout, skipTLS, caPath, forwardUserToken, tokenPath, requestHeader)
	if err != nil {
		return nil, err
	}
	cl, err := api.NewClient(api.Config{Address: url, RoundTripper: roundTripper})
	return &Client{Client: cl}, err
}

func CreateRoundTripper(timeout time.Duration, skipTLS bool, caPath string, forwardUserToken bool, tokenPath string, requestHeader http.Header) (http.RoundTripper, error) {
	maybeTLS := httpclient.NewTransport(timeout, skipTLS, caPath, "", "")

	var roundTripper http.RoundTripper
	if forwardUserToken && requestHeader != nil {
		h := requestHeader.Get(auth.AuthHeader)
		if h != "" && strings.HasPrefix(h, "Bearer ") {
			token := strings.TrimPrefix(h, "Bearer ")
			roundTripper = pconf.NewAuthorizationCredentialsRoundTripper("Bearer", pconf.NewInlineSecret(token), maybeTLS)
		} else {
			log.Debug("Missing Authorization token in user request")
		}
	} else if tokenPath != "" {
		bytes, err := os.ReadFile(tokenPath)
		if err != nil {
			log.WithError(err).Warnf("Failed to read authorization token from path '%s'. Continuing without token authentication. This may cause authentication failures if the Prometheus server requires authentication.", tokenPath)
			roundTripper = maybeTLS
		} else {
			roundTripper = pconf.NewAuthorizationCredentialsRoundTripper("Bearer", pconf.NewInlineSecret(string(bytes)), maybeTLS)
		}
	} else {
		roundTripper = maybeTLS
	}

	return roundTripper, nil
}

func (c *Client) executeQueryRange(ctx context.Context, q *Query) (pmod.Value, int, error) {
	var code int
	startTime := time.Now()
	defer func() {
		metrics.ObservePromCall(code, startTime)
	}()

	log.Debugf("executeQueryRange: %v; promQL=%s", q.Range, q.PromQL)
	v1api := v1.NewAPI(c.Client)
	result, warnings, _, err := v1api.QueryRange(ctx, q.PromQL, q.Range)
	log.Tracef("Result:\n%v", result)
	if len(warnings) > 0 {
		log.Infof("executeQueryRange warnings: %v", warnings)
	}
	if err != nil {
		log.Tracef("Error:\n%v", err)
		code = translateErrorCode(err)
		return nil, code, fmt.Errorf("error from Prometheus query: %w", err)
	}

	code = http.StatusOK
	return result, code, nil
}

func (c *Client) QueryMatrix(ctx context.Context, q *Query) (model.QueryResponse, int, error) {
	resp, code, err := c.executeQueryRange(ctx, q)
	if err != nil {
		log.WithError(err).Error("Error in QueryMatrix")
		return model.QueryResponse{}, code, err
	}
	// Transform response
	m, ok := resp.(pmod.Matrix)
	if !ok {
		err := fmt.Errorf("QueryMatrix: wrong return type: %T", resp)
		log.Error(err.Error())
		return model.QueryResponse{}, http.StatusInternalServerError, err
	}
	var convMatrix model.Matrix
	for i := range m {
		convMatrix = append(convMatrix, *m[i])
	}
	qr := model.QueryResponse{
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeMatrix,
			Result:     convMatrix,
		},
	}
	return qr, code, nil
}

func (c *Client) GetLabelValues(ctx context.Context, label string, match []string) ([]string, int, error) {
	log.Debugf("GetLabelValues: %s", label)
	v1api := v1.NewAPI(c.Client)
	result, warnings, _, err := v1api.LabelValues(ctx, label, match, time.Now().Add(-3*time.Hour), time.Now())
	if len(warnings) > 0 {
		log.Infof("GetLabelValues warnings: %v", warnings)
	}
	if err != nil {
		code := translateErrorCode(err)
		return nil, code, fmt.Errorf("could not get label values: %w", err)
	}
	log.Tracef("Result:\n%v", result)
	var asStrings []string
	for _, s := range result {
		asStrings = append(asStrings, string(s))
	}
	return asStrings, http.StatusOK, nil
}

func translateErrorCode(err error) int {
	var promError *v1.Error
	if errors.As(err, &promError) {
		if promError.Type == v1.ErrClient && strings.Contains(promError.Msg, "401") {
			return http.StatusUnauthorized
		} else if promError.Type == v1.ErrClient && strings.Contains(promError.Msg, "403") {
			return http.StatusForbidden
		}
	}
	return http.StatusServiceUnavailable
}
