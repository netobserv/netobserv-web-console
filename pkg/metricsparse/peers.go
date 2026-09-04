package metricsparse

import (
	"fmt"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	pmodel "github.com/prometheus/common/model"
)

func labelString(m pmodel.Metric, key string) string {
	v, ok := m[pmodel.LabelName(key)]
	if !ok {
		return ""
	}
	return string(v)
}

func nameAndType(name, typ string) *NameAndType {
	if name == "" || typ == "" {
		return nil
	}
	return &NameAndType{Name: name, Type: typ}
}

func peerID(fieldsMap map[string]string, owner, resource *NameAndType, addr, subnetLabel string, scopes []config.Scope) string {
	parts := make([]string, 0)
	customs := customScopes(scopes)
	for i := range customs {
		sc := &customs[i]
		if v := fieldsMap[sc.ID]; v != "" {
			parts = append(parts, sc.ID+"="+v)
		}
	}
	if owner != nil {
		parts = append(parts, "o="+owner.Type+"."+owner.Name)
	}
	if resource != nil {
		parts = append(parts, "r="+resource.Type+"."+resource.Name)
	} else if addr != "" {
		parts = append(parts, "a="+addr)
	} else if subnetLabel != "" {
		parts = append(parts, "sl="+subnetLabel)
	}
	if len(parts) == 0 {
		return idUnknown
	}
	return strings.Join(parts, ",")
}

func createPeer(fieldsMap map[string]string, owner, resource *NameAndType, addr, subnetLabel string, scopes []config.Scope) Peer {
	peer := Peer{
		ID:          peerID(fieldsMap, owner, resource, addr, subnetLabel, scopes),
		Addr:        addr,
		Owner:       owner,
		Resource:    resource,
		SubnetLabel: subnetLabel,
		IsAmbiguous: false,
		Scopes:      map[string]string{},
	}
	for k, v := range fieldsMap {
		if v != "" {
			peer.Scopes[k] = v
		}
	}

	if resource != nil {
		peer.ResourceKind = resource.Type
	} else if owner != nil {
		peer.ResourceKind = owner.Type
	}

	customs := customScopes(scopes)
	for i := len(customs) - 1; i >= 0; i-- {
		sc := &customs[i]
		if v := fieldsMap[sc.ID]; v != "" {
			peer.Scopes[sc.ID] = v
			if peer.ResourceKind == "" {
				peer.ResourceKind = sc.Name
			}
		}
	}

	if peer.ResourceKind == "" {
		if subnetLabel != "" && addr != "" {
			peer.ResourceKind = "Address"
		} else if subnetLabel != "" {
			peer.ResourceKind = "Subnet"
		} else if addr != "" {
			peer.ResourceKind = "Address"
		}
	}
	return peer
}

func peerFieldsFromMetric(m pmodel.Metric, prefix string, scopes []config.Scope) (map[string]string, *NameAndType, *NameAndType, string, string) {
	name := labelString(m, prefix+fields.Name)
	typ := labelString(m, prefix+fields.Type)
	ownerName := labelString(m, prefix+fields.OwnerName)
	ownerType := labelString(m, prefix+fields.OwnerType)
	addr := labelString(m, prefix+fields.Addr)
	subnet := labelString(m, prefix+fields.SubnetLabel)

	resource := nameAndType(name, typ)
	var owner *NameAndType
	if typ != ownerType {
		owner = nameAndType(ownerName, ownerType)
	}

	fieldsMap := map[string]string{}
	customs := customScopes(scopes)
	for i := range customs {
		sc := &customs[i]
		if len(sc.Labels) == 0 {
			continue
		}
		var label string
		if len(sc.Labels) == 1 {
			label = sc.Labels[0]
		} else {
			for _, l := range sc.Labels {
				if strings.HasPrefix(l, prefix) {
					label = l
					break
				}
			}
		}
		if label != "" {
			fieldsMap[sc.ID] = labelString(m, label)
		}
	}
	return fieldsMap, owner, resource, addr, subnet
}

func peerFromMetric(m pmodel.Metric, prefix string, scopes []config.Scope) Peer {
	fieldsMap, owner, resource, addr, subnet := peerFieldsFromMetric(m, prefix, scopes)
	return createPeer(fieldsMap, owner, resource, addr, subnet, scopes)
}

var shortKindMap = map[string]string{
	"Service":     "svc",
	"Deployment":  "depl",
	"DaemonSet":   "ds",
	"StatefulSet": "sts",
}

func peerDisplayName(p *Peer, inclNamespace, disambiguate bool) string {
	if p.Resource != nil {
		return formatNamedPeer(p, p.Resource.Name, p.Resource.Type, inclNamespace, disambiguate)
	}
	if p.Owner != nil {
		return formatNamedPeer(p, p.Owner.Name, p.Owner.Type, inclNamespace, disambiguate)
	}
	for _, key := range []string{"namespace", "host", "zone", "network", "cluster", "udn"} {
		if v := p.Scopes[key]; v != "" {
			return v
		}
	}
	for _, v := range p.Scopes {
		if v != "" {
			return v
		}
	}
	if p.SubnetLabel != "" && p.Addr != "" {
		return fmt.Sprintf("%s (%s)", p.SubnetLabel, p.Addr)
	}
	if p.SubnetLabel != "" {
		return p.SubnetLabel
	}
	if p.Addr != "" {
		return p.Addr
	}
	return ""
}

func formatNamedPeer(p *Peer, name, typ string, inclNamespace, disambiguate bool) string {
	disamb := ""
	if disambiguate && p.IsAmbiguous {
		short := shortKindMap[typ]
		if short == "" {
			short = strings.ToLower(typ)
		}
		disamb = " (" + short + ")"
	}
	if inclNamespace {
		if ns := p.Scopes["namespace"]; ns != "" {
			return ns + "." + name + disamb
		}
	}
	return name + disamb
}

func hasDirectionalLabels(m pmodel.Metric, prefix string) bool {
	for k, v := range m {
		ks := string(k)
		if strings.HasPrefix(ks, prefix) && len(ks) > len(prefix) && string(v) != "" {
			return true
		}
	}
	return false
}

// IsTopologyMetric reports whether a series has both Src* and Dst* labels.
func IsTopologyMetric(m pmodel.Metric) bool {
	return hasDirectionalLabels(m, fields.Src) && hasDirectionalLabels(m, fields.Dst)
}

// FormatPeerKindName returns resourceKind and display name for export rows.
func FormatPeerKindName(p *Peer) (kind, name string) {
	return p.ResourceKind, peerDisplayName(p, false, false)
}
