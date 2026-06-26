package httpclient

import (
	"crypto/tls"
	"crypto/x509"
	"io"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/sirupsen/logrus"
)

type Caller interface {
	Get(url string) ([]byte, int, error)
}

type httpClient struct {
	Caller
	client  http.Client
	headers map[string][]string
}

var slog = logrus.WithField("module", "server")

func NewClientWrapper(timeout time.Duration, overrideHeaders map[string][]string, skipTLS bool, capath string, userCertPath string, userKeyPath string) Caller {
	// TODO: use same prom RoundTripper helper insead of this client wrapper for Loki
	tr := NewTransport(timeout, skipTLS, capath, userCertPath, userKeyPath)
	return &httpClient{
		client:  http.Client{Transport: tr, Timeout: timeout},
		headers: overrideHeaders,
	}
}

func NewTransport(timeout time.Duration, skipTLS bool, capath string, userCertPath string, userKeyPath string) *http.Transport {
	transport := &http.Transport{
		DialContext:     (&net.Dialer{Timeout: timeout}).DialContext,
		IdleConnTimeout: timeout,
	}

	if skipTLS {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		slog.Warn("skipping TLS checks. SSL certificate verification is now disabled !")
	} else if capath != "" || userCertPath != "" {
		transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS13}

		if capath != "" {
			caCert, err := os.ReadFile(capath)
			if err != nil {
				slog.Errorf("Cannot load loki ca certificate: %v", err)
			} else {
				pool := x509.NewCertPool()
				pool.AppendCertsFromPEM(caCert)
				transport.TLSClientConfig.RootCAs = pool
			}
		}

		if userCertPath != "" {
			cert, err := tls.LoadX509KeyPair(userCertPath, userKeyPath)
			if err != nil {
				slog.Errorf("Cannot load loki user certificate: %v", err)
			} else {
				transport.TLSClientConfig.Certificates = []tls.Certificate{cert}
			}
		}
	}

	return transport
}

func (hc *httpClient) Get(url string) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	for k, v := range hc.headers {
		req.Header[k] = v
	}

	resp, err := hc.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return body, resp.StatusCode, err
}
