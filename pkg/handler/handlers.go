package handler

import (
	"github.com/netobserv/network-observability-console-plugin/pkg/backend/backends"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
)

type Handlers struct {
	Cfg      *config.Config
	Backends *backends.Orchestrator
}
