package handler

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/auth"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/resources"
	corev1 "k8s.io/api/core/v1"
	kerr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

const flowCaptureOutputDirectory = "output"

var flowCaptureGVR = schema.GroupVersionResource{
	Group: "flows.netobserv.io", Version: "v1alpha1", Resource: "flowcaptures",
}

// DownloadFlowCaptureOutput streams the collector's output directory as a gzip archive.
// The pod and path are resolved server-side from the FlowCapture; neither is accepted from the client.
func (h *Handlers) DownloadFlowCaptureOutput(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		namespace, name := vars["namespace"], vars["name"]
		if namespace == "" || name == "" {
			apierrors.Write(w, http.StatusBadRequest, fmt.Errorf("namespace and FlowCapture name are required"))
			return
		}

		token, code, err := auth.RetrieveToken(r.Header, h.Cfg.Kubernetes.ForwardUserToken, h.Cfg.Kubernetes.TokenPath)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		capture, err := resources.Get(r.Context(), token, namespace, name, flowCaptureGVR)
		if err != nil {
			apierrors.Write(w, statusCodeForKubernetesError(err), err)
			return
		}
		phase, _, _ := unstructured.NestedString(capture.Object, "status", "phase")
		outputType, _, _ := unstructured.NestedString(capture.Object, "spec", "outputType")
		if outputType != "flows" && outputType != "packets" {
			apierrors.Write(w, http.StatusBadRequest, fmt.Errorf("FlowCapture %q does not produce downloadable output", name))
			return
		}
		if phase != "Running" && phase != "Completed" && phase != "Failed" {
			apierrors.Write(w, http.StatusConflict, fmt.Errorf("FlowCapture %q has no downloadable output yet", name))
			return
		}

		restConfig, err := rest.InClusterConfig()
		if err != nil {
			apierrors.Write(w, http.StatusInternalServerError, err)
			return
		}
		if token != "" {
			restConfig.BearerToken = token
			restConfig.BearerTokenFile = ""
		}
		kubeClient, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			apierrors.Write(w, http.StatusInternalServerError, err)
			return
		}

		selector := labels.Set{
			"component":                                "collector",
			"flows.netobserv.io/flowcapture-name":      name,
			"flows.netobserv.io/flowcapture-namespace": namespace,
		}.AsSelector().String()
		pods, err := kubeClient.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{LabelSelector: selector})
		if err != nil {
			apierrors.Write(w, statusCodeForKubernetesError(err), err)
			return
		}
		pod := selectFlowCaptureCollector(pods.Items)
		if pod == nil {
			apierrors.Write(w, http.StatusNotFound, fmt.Errorf("collector pod for FlowCapture %q was not found", name))
			return
		}
		if pod.Status.Phase != corev1.PodRunning {
			apierrors.Write(w, http.StatusConflict, fmt.Errorf("collector pod for FlowCapture %q is not running", name))
			return
		}

		container := flowCaptureCollectorContainer(pod)
		req := kubeClient.CoreV1().RESTClient().Post().
			Namespace(namespace).Resource("pods").Name(pod.Name).SubResource("exec").
			VersionedParams(&corev1.PodExecOptions{
				Container: container,
				// A running capture may not have created its output directory yet. In
				// that case return an empty, valid archive instead of failing the exec.
				Command: []string{"sh", "-c", "if [ -d output ]; then exec tar -C output -cf - .; fi"},
				Stdout:  true,
				Stderr:  true,
			}, scheme.ParameterCodec)
		executor, err := remotecommand.NewSPDYExecutor(restConfig, http.MethodPost, req.URL())
		if err != nil {
			apierrors.Write(w, http.StatusInternalServerError, err)
			return
		}

		var stderr bytes.Buffer
		w.Header().Set("Content-Type", "application/gzip")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s-output.tar.gz\"", safeFlowCaptureFilename(name)))
		w.WriteHeader(http.StatusOK)
		gzipWriter := gzip.NewWriter(w)
		err = executor.StreamWithContext(r.Context(), remotecommand.StreamOptions{
			Stdout: gzipWriter,
			Stderr: &stderr,
		})
		closeErr := gzipWriter.Close()
		if err != nil {
			hlog.WithError(err).WithField("flowcapture", namespace+"/"+name).Error("failed to download FlowCapture output")
			return
		}
		if closeErr != nil {
			hlog.WithError(closeErr).WithField("flowcapture", namespace+"/"+name).Error("failed to finalize FlowCapture output download")
			return
		}
		if stderr.Len() > 0 {
			hlog.WithField("flowcapture", namespace+"/"+name).Warnf("collector output download reported: %s", strings.TrimSpace(stderr.String()))
		}
	}
}

func selectFlowCaptureCollector(pods []corev1.Pod) *corev1.Pod {
	for i := range pods {
		if pods[i].Status.Phase == corev1.PodRunning {
			return &pods[i]
		}
	}
	if len(pods) > 0 {
		return &pods[0]
	}
	return nil
}

func flowCaptureCollectorContainer(pod *corev1.Pod) string {
	for _, container := range pod.Spec.Containers {
		if container.Name == "collector" {
			return container.Name
		}
	}
	if len(pod.Spec.Containers) > 0 {
		return pod.Spec.Containers[0].Name
	}
	return ""
}

func safeFlowCaptureFilename(name string) string {
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			return r
		}
		return '-'
	}, name)
	if name == "" {
		return "flowcapture"
	}
	return name
}

func statusCodeForKubernetesError(err error) int {
	if kerr.IsNotFound(err) {
		return http.StatusNotFound
	}
	if kerr.IsForbidden(err) {
		return http.StatusForbidden
	}
	return http.StatusInternalServerError
}
