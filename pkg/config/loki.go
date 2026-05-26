package config

import (
	"fmt"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/utils"
)

type Loki struct {
	URL                string            `yaml:"url" json:"url"`
	Labels             []string          `yaml:"labels" json:"labels"`
	FieldsType         map[string]string `yaml:"fieldsType" json:"fieldsType"`
	FieldsFormat       map[string]string `yaml:"fieldsFormat" json:"fieldsFormat"`
	StatusURL          string            `yaml:"statusUrl,omitempty" json:"statusUrl,omitempty"`
	Timeout            Duration          `yaml:"timeout,omitempty" json:"timeout,omitempty"`
	TenantID           string            `yaml:"tenantID,omitempty" json:"tenantID,omitempty"`
	TokenPath          string            `yaml:"tokenPath,omitempty" json:"tokenPath,omitempty"`
	SkipTLS            bool              `yaml:"skipTls,omitempty" json:"skipTls,omitempty"`
	CAPath             string            `yaml:"caPath,omitempty" json:"caPath,omitempty"`
	Status             string            `yaml:"status,omitempty" json:"status,omitempty"`
	StatusSkipTLS      bool              `yaml:"statusSkipTls,omitempty" json:"statusSkipTls,omitempty"`
	StatusCAPath       string            `yaml:"statusCaPath,omitempty" json:"statusCaPath,omitempty"`
	StatusUserCertPath string            `yaml:"statusUserCertPath,omitempty" json:"statusUserCertPath,omitempty"`
	StatusUserKeyPath  string            `yaml:"statusUserKeyPath,omitempty" json:"statusUserKeyPath,omitempty"`
	ForwardUserToken   bool              `yaml:"forwardUserToken,omitempty" json:"forwardUserToken,omitempty"`
	labelsMap          map[string]struct{}
}

func (l *Loki) GetStatusURL() string {
	if l.StatusURL != "" {
		return l.StatusURL
	}
	return l.URL
}

func (l *Loki) IsLabel(key string) bool {
	if l.labelsMap == nil {
		l.labelsMap = utils.GetMapInterface(l.Labels)
	}
	_, isLabel := l.labelsMap[key]
	return isLabel
}

func (l *Loki) IsNumeric(v string) bool {
	// check on Field / SrcField / DstField since we remove prefix in some cases for common filtering
	types := fmt.Sprintf("%s|%s|%s", l.FieldsType[v], l.FieldsType["Src"+v], l.FieldsType["Dst"+v])
	return strings.Contains(types, "number")
}

func (l *Loki) IsIP(v string) bool {
	// check on Field / SrcField / DstField since we remove prefix in some cases for common filtering
	formats := fmt.Sprintf("%s|%s|%s", l.FieldsFormat[v], l.FieldsFormat["Src"+v], l.FieldsFormat["Dst"+v])
	return strings.Contains(formats, "IP")
}

func (l *Loki) IsArray(v string) bool {
	// check on Field / SrcField / DstField since we remove prefix in some cases for common filtering
	types := fmt.Sprintf("%s|%s|%s", l.FieldsType[v], l.FieldsType["Src"+v], l.FieldsType["Dst"+v])
	return strings.Contains(types, "[]")

}
