package model

type Status struct {
	Loki       DatasourceStatus `yaml:"loki" json:"loki"`
	Prometheus DatasourceStatus `yaml:"prometheus" json:"prometheus"`
}

type DatasourceStatus struct {
	IsEnabled       bool   `yaml:"isEnabled" json:"isEnabled"`
	NamespacesCount int    `yaml:"namespacesCount" json:"namespacesCount"`
	IsReady         bool   `yaml:"isReady" json:"isReady"`
	Error           string `yaml:"error" json:"error"`
	ErrorCode       int    `yaml:"errorCode" json:"errorCode"`
}
