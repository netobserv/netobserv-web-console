package constants

type MetricFunction string
type RecordType string
type DataSource string
type PacketLoss string
type Discriminator string
type Direction string

const (
	AppLabel        = "app"
	AppLabelValue   = "netobserv-flowcollector"
	RecordTypeLabel = "_RecordType"

	MetricTypeFlows          = "Flows"
	MetricTypeBytes          = "Bytes"
	MetricTypePackets        = "Packets"
	MetricTypeDroppedBytes   = "PktDropBytes"
	MetricTypeDroppedPackets = "PktDropPackets"
	MetricTypeDNSLatency     = "DnsLatencyMs"
	MetricTypeDNSFlows       = "DnsFlows"
	MetricTypeTLSFlows       = "TlsFlows"
	MetricTypeFlowRTT        = "TimeFlowRttNs"
	DefaultMetricType        = MetricTypeBytes

	MetricFunctionCount   MetricFunction = "count"
	MetricFunctionSum     MetricFunction = "sum"
	MetricFunctionAvg     MetricFunction = "avg"
	MetricFunctionMin     MetricFunction = "min"
	MetricFunctionMax     MetricFunction = "max"
	MetricFunctionP90     MetricFunction = "p90"
	MetricFunctionP99     MetricFunction = "p99"
	MetricFunctionRate    MetricFunction = "rate"
	DefaultMetricFunction MetricFunction = MetricFunctionRate

	RecordTypeAllConnections RecordType = "allConnections"
	RecordTypeNewConnection  RecordType = "newConnection"
	RecordTypeHeartbeat      RecordType = "heartbeat"
	RecordTypeEndConnection  RecordType = "endConnection"
	RecordTypeLog            RecordType = "flowLog"
	DefaultRecordType        RecordType = RecordTypeLog

	DataSourceAuto    DataSource = "auto"
	DataSourceProm    DataSource = "prom"
	DataSourceLoki    DataSource = "loki"
	DefaultDataSource DataSource = DataSourceAuto

	PacketLossDropped PacketLoss = "dropped"
	PacketLossHasDrop PacketLoss = "hasDrops"
	PacketLossSent    PacketLoss = "sent"
	PacketLossAll     PacketLoss = "all"
	DefaultPacketLoss PacketLoss = PacketLossAll

	Ingress Direction = "0"
	Egress  Direction = "1"
	Inner   Direction = "2"
)

var AnyConnectionType = []string{
	string(RecordTypeAllConnections),
	string(RecordTypeNewConnection),
	string(RecordTypeHeartbeat),
	string(RecordTypeEndConnection),
}

var ConnectionTypes = []string{
	string(RecordTypeNewConnection),
	string(RecordTypeHeartbeat),
	string(RecordTypeEndConnection),
}
