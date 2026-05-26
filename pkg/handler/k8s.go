package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/auth"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/resources"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils"

	kerr "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func (h *Handlers) GetUDNIdss(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		token, code, err := auth.RetrieveToken(r.Header, h.Cfg.Kubernetes.ForwardUserToken, h.Cfg.Kubernetes.TokenPath)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		cudns, err := resources.List(ctx, token, schema.GroupVersionResource{
			Group:    "k8s.ovn.org",
			Version:  "v1",
			Resource: "clusteruserdefinednetworks",
		})
		if err != nil {
			var k8sErr *kerr.StatusError
			if errors.As(err, &k8sErr) {
				apierrors.Write(w, int(k8sErr.ErrStatus.Code), err)
			} else {
				apierrors.Write(w, http.StatusInternalServerError, err)
			}
		}

		udns, err := resources.List(ctx, token, schema.GroupVersionResource{
			Group:    "k8s.ovn.org",
			Version:  "v1",
			Resource: "userdefinednetworks",
		})
		if err != nil {
			var k8sErr *kerr.StatusError
			if errors.As(err, &k8sErr) {
				apierrors.Write(w, int(k8sErr.ErrStatus.Code), err)
			} else {
				apierrors.Write(w, http.StatusInternalServerError, err)
			}
		}

		values := []string{}
		for _, cudn := range cudns {
			md := cudn.Object["metadata"].(map[string]interface{})
			values = append(values, fmt.Sprintf("%s", md["name"]))
		}
		for _, udn := range udns {
			md := udn.Object["metadata"].(map[string]interface{})
			values = append(values, fmt.Sprintf("%s/%s", md["namespace"], md["name"]))
		}
		writeJSON(w, http.StatusOK, utils.NonEmpty(utils.Dedup(values)))
	}
}

func (h *Handlers) GetFlowCollector(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		token, code, err := auth.RetrieveToken(r.Header, h.Cfg.Kubernetes.ForwardUserToken, h.Cfg.Kubernetes.TokenPath)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		fc, err := resources.Get(ctx, token, "", "cluster", schema.GroupVersionResource{
			Group:    "flows.netobserv.io",
			Version:  "v1beta2",
			Resource: "flowcollectors",
		})
		if err != nil {
			var k8sErr *kerr.StatusError
			if errors.As(err, &k8sErr) {
				apierrors.Write(w, int(k8sErr.ErrStatus.Code), err)
			} else {
				apierrors.Write(w, http.StatusInternalServerError, err)
			}
			return
		}

		writeJSON(w, http.StatusOK, fc)
	}
}
