// File only used in tests or dev console

// These values come from original useK8sModels using debug
export const k8sModels = {
  "ImageStreamImport": {
    "label": "ImageStreamImport",
    "labelKey": "public~ImageStreamImport",
    "apiVersion": "v1",
    "apiGroup": "image.openshift.io",
    "plural": "imagestreamimports",
    "abbr": "ISI",
    "namespaced": true,
    "kind": "ImageStreamImport",
    "id": "imagestreamimport",
    "labelPlural": "ImageStreamImports",
    "labelPluralKey": "ImageStreamImports",
    "verbs": [
      "create"
    ]
  },
  "metal3.io~v1alpha1~HostFirmwareSettings": {
    "kind": "HostFirmwareSettings",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "hfs"
    ],
    "label": "HostFirmwareSettings",
    "plural": "hostfirmwaresettings",
    "apiVersion": "v1alpha1",
    "abbr": "HFS",
    "apiGroup": "metal3.io",
    "labelPlural": "HostFirmwareSettings",
    "path": "hostfirmwaresettings",
    "id": "hostfirmwaresettings",
    "crd": true
  },
  "NetworkPolicy": {
    "label": "NetworkPolicy",
    "labelKey": "public~NetworkPolicy",
    "labelPlural": "NetworkPolicies",
    "labelPluralKey": "public~NetworkPolicies",
    "apiVersion": "v1",
    "apiGroup": "networking.k8s.io",
    "plural": "networkpolicies",
    "abbr": "NP",
    "namespaced": true,
    "kind": "NetworkPolicy",
    "id": "networkpolicy",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "netpol"
    ]
  },
  "security.openshift.io~v1~PodSecurityPolicyReview": {
    "kind": "PodSecurityPolicyReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "PodSecurityPolicyReview",
    "plural": "podsecuritypolicyreviews",
    "apiVersion": "v1",
    "abbr": "PSPR",
    "apiGroup": "security.openshift.io",
    "labelPlural": "PodSecurityPolicyReviews",
    "path": "podsecuritypolicyreviews",
    "id": "",
    "crd": true
  },
  "helm.openshift.io~v1beta1~HelmChartRepository": {
    "kind": "HelmChartRepository",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Helm Chart Repository",
    "plural": "helmchartrepositories",
    "apiVersion": "v1beta1",
    "abbr": "HCR",
    "apiGroup": "helm.openshift.io",
    "labelPlural": "Helm Chart Repositories",
    "path": "helmchartrepositories",
    "id": "helmchartrepository",
    "crd": true
  },
  "authorization.k8s.io~v1~SubjectAccessReview": {
    "kind": "SubjectAccessReview",
    "namespaced": false,
    "verbs": [
      "create"
    ],
    "label": "SubjectAccessReview",
    "plural": "subjectaccessreviews",
    "apiVersion": "v1",
    "abbr": "SAR",
    "apiGroup": "authorization.k8s.io",
    "labelPlural": "SubjectAccessReviews",
    "path": "subjectaccessreviews",
    "id": "",
    "crd": true
  },
  "user.openshift.io~v1~UserIdentityMapping": {
    "kind": "UserIdentityMapping",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "get",
      "patch",
      "update"
    ],
    "label": "UserIdentityMapping",
    "plural": "useridentitymappings",
    "apiVersion": "v1",
    "abbr": "UIM",
    "apiGroup": "user.openshift.io",
    "labelPlural": "UserIdentityMappings",
    "path": "useridentitymappings",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1~CloudCredential": {
    "kind": "CloudCredential",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "CloudCredential",
    "plural": "cloudcredentials",
    "apiVersion": "v1",
    "abbr": "CC",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "CloudCredentials",
    "path": "cloudcredentials",
    "id": "cloudcredential",
    "crd": true
  },
  "config.openshift.io~v1~Build": {
    "kind": "Build",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Build",
    "plural": "builds",
    "apiVersion": "v1",
    "abbr": "B",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Builds",
    "path": "builds",
    "id": "build",
    "crd": true
  },
  "config.openshift.io~v1~Proxy": {
    "kind": "Proxy",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Proxy",
    "plural": "proxies",
    "apiVersion": "v1",
    "abbr": "P",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Proxies",
    "path": "proxies",
    "id": "proxy",
    "crd": true
  },
  "oauth.openshift.io~v1~UserOAuthAccessToken": {
    "kind": "UserOAuthAccessToken",
    "namespaced": false,
    "verbs": [
      "delete",
      "get",
      "list",
      "watch"
    ],
    "label": "UserOAuthAccessToken",
    "plural": "useroauthaccesstokens",
    "apiVersion": "v1",
    "abbr": "UOAA",
    "apiGroup": "oauth.openshift.io",
    "labelPlural": "UserOAuthAccessTokens",
    "path": "useroauthaccesstokens",
    "id": "",
    "crd": true
  },
  "admissionregistration.k8s.io~v1~MutatingWebhookConfiguration": {
    "kind": "MutatingWebhookConfiguration",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "MutatingWebhookConfiguration",
    "plural": "mutatingwebhookconfigurations",
    "apiVersion": "v1",
    "abbr": "MWC",
    "apiGroup": "admissionregistration.k8s.io",
    "labelPlural": "MutatingWebhookConfigurations",
    "path": "mutatingwebhookconfigurations",
    "id": "",
    "crd": true
  },
  "core~v1~Binding": {
    "kind": "Binding",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "Binding",
    "plural": "bindings",
    "apiVersion": "v1",
    "abbr": "B",
    "labelPlural": "Bindings",
    "path": "bindings",
    "id": "",
    "crd": true
  },
  "monitoring.coreos.com~v1alpha1~AlertmanagerConfig": {
    "kind": "AlertmanagerConfig",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "AlertmanagerConfig",
    "plural": "alertmanagerconfigs",
    "apiVersion": "v1alpha1",
    "abbr": "AC",
    "apiGroup": "monitoring.coreos.com",
    "labelPlural": "AlertmanagerConfigs",
    "path": "alertmanagerconfigs",
    "id": "alertmanagerconfig",
    "crd": true
  },
  "operators.coreos.com~v1~OperatorGroup": {
    "kind": "OperatorGroup",
    "label": "OperatorGroup",
    "labelKey": "olm~OperatorGroup",
    "labelPlural": "OperatorGroups",
    "labelPluralKey": "olm~OperatorGroups",
    "apiGroup": "operators.coreos.com",
    "apiVersion": "v1",
    "abbr": "OG",
    "namespaced": true,
    "crd": true,
    "plural": "operatorgroups",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "og"
    ]
  },
  "CertificateSigningRequest": {
    "apiVersion": "v1",
    "apiGroup": "certificates.k8s.io",
    "label": "CertificateSigningRequest",
    "labelKey": "public~CertificateSigningRequest",
    "plural": "certificatesigningrequests",
    "abbr": "CSR",
    "kind": "CertificateSigningRequest",
    "id": "certificateigningrequests",
    "labelPlural": "CertificateSigningRequests",
    "labelPluralKey": "public~CertificateSigningRequests",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "csr"
    ]
  },
  "config.openshift.io~v1~Network": {
    "label": "Network",
    "labelPlural": "Networks",
    "apiVersion": "v1",
    "apiGroup": "config.openshift.io",
    "plural": "networks",
    "abbr": "NO",
    "namespaced": false,
    "kind": "Network",
    "id": "network",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "user.openshift.io~v1~Identity": {
    "kind": "Identity",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "Identity",
    "plural": "identities",
    "apiVersion": "v1",
    "abbr": "I",
    "apiGroup": "user.openshift.io",
    "labelPlural": "Identities",
    "path": "identities",
    "id": "",
    "crd": true
  },
  "Node": {
    "apiVersion": "v1",
    "label": "Node",
    "labelKey": "public~Node",
    "plural": "nodes",
    "abbr": "N",
    "kind": "Node",
    "id": "node",
    "labelPlural": "Nodes",
    "labelPluralKey": "public~Nodes",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "no"
    ],
    "color": "#8476D1"
  },
  "LimitRange": {
    "label": "LimitRange",
    "labelKey": "public~LimitRange",
    "apiVersion": "v1",
    "plural": "limitranges",
    "abbr": "LR",
    "namespaced": true,
    "kind": "LimitRange",
    "id": "limitrange",
    "labelPlural": "LimitRanges",
    "labelPluralKey": "public~LimitRanges",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "limits"
    ]
  },
  "operator.openshift.io~v1~KubeScheduler": {
    "kind": "KubeScheduler",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "KubeScheduler",
    "plural": "kubeschedulers",
    "apiVersion": "v1",
    "abbr": "KS",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "KubeSchedulers",
    "path": "kubeschedulers",
    "id": "kubescheduler",
    "crd": true
  },
  "storage.k8s.io~v1~VolumeAttachment": {
    "kind": "VolumeAttachment",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "VolumeAttachment",
    "plural": "volumeattachments",
    "apiVersion": "v1",
    "abbr": "VA",
    "apiGroup": "storage.k8s.io",
    "labelPlural": "VolumeAttachments",
    "path": "volumeattachments",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1alpha1~ImageContentSourcePolicy": {
    "kind": "ImageContentSourcePolicy",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ImageContentSourcePolicy",
    "plural": "imagecontentsourcepolicies",
    "apiVersion": "v1alpha1",
    "abbr": "ICSP",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "ImageContentSourcePolicies",
    "path": "imagecontentsourcepolicies",
    "id": "imagecontentsourcepolicy",
    "crd": true
  },
  "operator.openshift.io~v1~Network": {
    "kind": "Network",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Network",
    "plural": "networks",
    "apiVersion": "v1",
    "abbr": "N",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "Networks",
    "path": "networks",
    "id": "network",
    "crd": true
  },
  "metal3.io~v1alpha1~BareMetalHost": {
    "label": "Bare Metal Host",
    "labelPlural": "Bare Metal Hosts",
    "apiVersion": "v1alpha1",
    "apiGroup": "metal3.io",
    "plural": "baremetalhosts",
    "abbr": "BMH",
    "namespaced": true,
    "kind": "BareMetalHost",
    "id": "baremetalhost",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "bmh",
      "bmhost"
    ]
  },
  "operator.openshift.io~v1~Authentication": {
    "kind": "Authentication",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Authentication",
    "plural": "authentications",
    "apiVersion": "v1",
    "abbr": "A",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "Authentications",
    "path": "authentications",
    "id": "authentication",
    "crd": true
  },
  "operators.coreos.com~v1alpha1~Subscription": {
    "kind": "Subscription",
    "label": "Subscription",
    "labelKey": "olm~Subscription",
    "labelPlural": "Subscriptions",
    "labelPluralKey": "olm~Subscriptions",
    "apiGroup": "operators.coreos.com",
    "apiVersion": "v1alpha1",
    "abbr": "SUB",
    "namespaced": true,
    "crd": true,
    "plural": "subscriptions",
    "legacyPluralURL": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "sub",
      "subs"
    ]
  },
  "metrics.k8s.io~v1beta1~NodeMetrics": {
    "kind": "NodeMetrics",
    "namespaced": false,
    "verbs": [
      "get",
      "list"
    ],
    "label": "NodeMetrics",
    "plural": "nodes",
    "apiVersion": "v1beta1",
    "abbr": "NM",
    "apiGroup": "metrics.k8s.io",
    "labelPlural": "NodeMetrics",
    "path": "nodes",
    "id": "",
    "crd": true
  },
  "config.openshift.io~v1~OperatorHub": {
    "kind": "OperatorHub",
    "label": "OperatorHub",
    "labelKey": "olm~OperatorHub",
    "labelPlural": "OperatorHubs",
    "labelPluralKey": "olm~OperatorHubs",
    "apiGroup": "config.openshift.io",
    "apiVersion": "v1",
    "abbr": "OH",
    "namespaced": false,
    "crd": true,
    "plural": "operatorhubs",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "operator.openshift.io~v1~OpenShiftControllerManager": {
    "kind": "OpenShiftControllerManager",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "OpenShiftControllerManager",
    "plural": "openshiftcontrollermanagers",
    "apiVersion": "v1",
    "abbr": "OSCM",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "OpenShiftControllerManagers",
    "path": "openshiftcontrollermanagers",
    "id": "openshiftcontrollermanager",
    "crd": true
  },
  "authorization.k8s.io~v1~LocalSubjectAccessReview": {
    "kind": "LocalSubjectAccessReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "LocalSubjectAccessReview",
    "plural": "localsubjectaccessreviews",
    "apiVersion": "v1",
    "abbr": "LSAR",
    "apiGroup": "authorization.k8s.io",
    "labelPlural": "LocalSubjectAccessReviews",
    "path": "localsubjectaccessreviews",
    "id": "",
    "crd": true
  },
  "config.openshift.io~v1~Authentication": {
    "kind": "Authentication",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Authentication",
    "plural": "authentications",
    "apiVersion": "v1",
    "abbr": "A",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Authentications",
    "path": "authentications",
    "id": "authentication",
    "crd": true
  },
  "machineconfiguration.openshift.io~v1~MachineConfigPool": {
    "label": "MachineConfigPool",
    "labelKey": "public~MachineConfigPool",
    "labelPlural": "MachineConfigPools",
    "labelPluralKey": "public~MachineConfigPools",
    "apiVersion": "v1",
    "apiGroup": "machineconfiguration.openshift.io",
    "plural": "machineconfigpools",
    "abbr": "MCP",
    "namespaced": false,
    "kind": "MachineConfigPool",
    "id": "machineconfigpool",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "mcp"
    ]
  },
  "Pod": {
    "apiVersion": "v1",
    "label": "Pod",
    "labelKey": "public~Pod",
    "plural": "pods",
    "abbr": "P",
    "namespaced": true,
    "kind": "Pod",
    "id": "pod",
    "labelPlural": "Pods",
    "labelPluralKey": "public~Pods",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "po"
    ],
    "color": "#009596"
  },
  "metal3.io~v1alpha1~PreprovisioningImage": {
    "kind": "PreprovisioningImage",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "ppimg"
    ],
    "label": "PreprovisioningImage",
    "plural": "preprovisioningimages",
    "apiVersion": "v1alpha1",
    "abbr": "PI",
    "apiGroup": "metal3.io",
    "labelPlural": "PreprovisioningImages",
    "path": "preprovisioningimages",
    "id": "preprovisioningimage",
    "crd": true
  },
  "operator.openshift.io~v1~KubeAPIServer": {
    "kind": "KubeAPIServer",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "KubeAPIServer",
    "plural": "kubeapiservers",
    "apiVersion": "v1",
    "abbr": "KAPI",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "KubeAPIServers",
    "path": "kubeapiservers",
    "id": "kubeapiserver",
    "crd": true
  },
  "Deployment": {
    "label": "Deployment",
    "labelKey": "public~Deployment",
    "apiVersion": "v1",
    "apiGroup": "apps",
    "plural": "deployments",
    "abbr": "D",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "Deployment",
    "id": "deployment",
    "labelPlural": "Deployments",
    "labelPluralKey": "public~Deployments",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "deploy"
    ],
    "color": "#004080"
  },
  "console.openshift.io~v1alpha1~ConsolePlugin": {
    "label": "ConsolePlugin",
    "labelKey": "public~ConsolePlugin",
    "apiVersion": "v1alpha1",
    "apiGroup": "console.openshift.io",
    "plural": "consoleplugins",
    "abbr": "CP",
    "namespaced": false,
    "kind": "ConsolePlugin",
    "id": "consoleplugin",
    "labelPlural": "ConsolePlugins",
    "labelPluralKey": "public~ConsolePlugins",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "authorization.openshift.io~v1~SelfSubjectRulesReview": {
    "kind": "SelfSubjectRulesReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "SelfSubjectRulesReview",
    "plural": "selfsubjectrulesreviews",
    "apiVersion": "v1",
    "abbr": "SSRR",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "SelfSubjectRulesReviews",
    "path": "selfsubjectrulesreviews",
    "id": "",
    "crd": true
  },
  "tuned.openshift.io~v1~Profile": {
    "kind": "Profile",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Profile",
    "plural": "profiles",
    "apiVersion": "v1",
    "abbr": "P",
    "apiGroup": "tuned.openshift.io",
    "labelPlural": "Profiles",
    "path": "profiles",
    "id": "profile",
    "crd": true
  },
  "monitoring.coreos.com~v1~ServiceMonitor": {
    "kind": "ServiceMonitor",
    "label": "ServiceMonitor",
    "labelKey": "public~ServiceMonitor",
    "labelPlural": "ServiceMonitors",
    "labelPluralKey": "public~ServiceMonitors",
    "apiGroup": "monitoring.coreos.com",
    "apiVersion": "v1",
    "abbr": "SM",
    "namespaced": true,
    "crd": true,
    "plural": "servicemonitors",
    "propagationPolicy": "Foreground",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "flowcontrol.apiserver.k8s.io~v1beta2~FlowSchema": {
    "kind": "FlowSchema",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "FlowSchema",
    "plural": "flowschemas",
    "apiVersion": "v1beta2",
    "abbr": "FS",
    "apiGroup": "flowcontrol.apiserver.k8s.io",
    "labelPlural": "FlowSchemas",
    "path": "flowschemas",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1~IngressController": {
    "kind": "IngressController",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "IngressController",
    "plural": "ingresscontrollers",
    "apiVersion": "v1",
    "abbr": "IC",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "IngressControllers",
    "path": "ingresscontrollers",
    "id": "ingresscontroller",
    "crd": true
  },
  "image.openshift.io~v1~Image": {
    "kind": "Image",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "Image",
    "plural": "images",
    "apiVersion": "v1",
    "abbr": "I",
    "apiGroup": "image.openshift.io",
    "labelPlural": "Images",
    "path": "images",
    "id": "",
    "crd": true
  },
  "metal3.io~v1alpha1~Provisioning": {
    "kind": "Provisioning",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Provisioning",
    "plural": "provisionings",
    "apiVersion": "v1alpha1",
    "abbr": "P",
    "apiGroup": "metal3.io",
    "labelPlural": "Provisionings",
    "path": "provisionings",
    "id": "provisioning",
    "crd": true
  },
  "flowcontrol.apiserver.k8s.io~v1beta1~FlowSchema": {
    "kind": "FlowSchema",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "FlowSchema",
    "plural": "flowschemas",
    "apiVersion": "v1beta1",
    "abbr": "FS",
    "apiGroup": "flowcontrol.apiserver.k8s.io",
    "labelPlural": "FlowSchemas",
    "path": "flowschemas",
    "id": "",
    "crd": true
  },
  "scheduling.k8s.io~v1~PriorityClass": {
    "kind": "PriorityClass",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "pc"
    ],
    "label": "PriorityClass",
    "plural": "priorityclasses",
    "apiVersion": "v1",
    "abbr": "PC",
    "apiGroup": "scheduling.k8s.io",
    "labelPlural": "PriorityClasses",
    "path": "priorityclasses",
    "id": "",
    "crd": true
  },
  "DeploymentConfig": {
    "label": "DeploymentConfig",
    "labelKey": "public~DeploymentConfig",
    "apiVersion": "v1",
    "apiGroup": "apps.openshift.io",
    "plural": "deploymentconfigs",
    "abbr": "DC",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "DeploymentConfig",
    "id": "deploymentconfig",
    "labelPlural": "DeploymentConfigs",
    "labelPluralKey": "public~DeploymentConfigs",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "dc"
    ],
    "color": "#004080"
  },
  "quota.openshift.io~v1~ClusterResourceQuota": {
    "label": "ClusterResourceQuota",
    "labelKey": "public~ClusterResourceQuota",
    "apiGroup": "quota.openshift.io",
    "apiVersion": "v1",
    "plural": "clusterresourcequotas",
    "abbr": "CRQ",
    "namespaced": false,
    "kind": "ClusterResourceQuota",
    "id": "clusterresourcequota",
    "labelPlural": "ClusterResourceQuotas",
    "labelPluralKey": "public~ClusterResourceQuotas",
    "crd": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "clusterquota"
    ]
  },
  "image.openshift.io~v1~ImageStreamMapping": {
    "kind": "ImageStreamMapping",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "ImageStreamMapping",
    "plural": "imagestreammappings",
    "apiVersion": "v1",
    "abbr": "ISM",
    "apiGroup": "image.openshift.io",
    "labelPlural": "ImageStreamMappings",
    "path": "imagestreammappings",
    "id": "",
    "crd": true
  },
  "events.k8s.io~v1beta1~Event": {
    "kind": "Event",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ev"
    ],
    "label": "Event",
    "plural": "events",
    "apiVersion": "v1beta1",
    "abbr": "E",
    "apiGroup": "events.k8s.io",
    "labelPlural": "Events",
    "path": "events",
    "id": "",
    "crd": true
  },
  "monitoring.coreos.com~v1~PrometheusRule": {
    "kind": "PrometheusRule",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "PrometheusRule",
    "plural": "prometheusrules",
    "apiVersion": "v1",
    "abbr": "PR",
    "apiGroup": "monitoring.coreos.com",
    "labelPlural": "PrometheusRules",
    "path": "prometheusrules",
    "id": "prometheusrule",
    "crd": true
  },
  "apiserver.openshift.io~v1~APIRequestCount": {
    "kind": "APIRequestCount",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "APIRequestCount",
    "plural": "apirequestcounts",
    "apiVersion": "v1",
    "abbr": "APIR",
    "apiGroup": "apiserver.openshift.io",
    "labelPlural": "APIRequestCounts",
    "path": "apirequestcounts",
    "id": "apirequestcount",
    "crd": true
  },
  "config.openshift.io~v1~Ingress": {
    "kind": "Ingress",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Ingress",
    "plural": "ingresses",
    "apiVersion": "v1",
    "abbr": "I",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Ingresses",
    "path": "ingresses",
    "id": "ingress",
    "crd": true
  },
  "ReplicationController": {
    "apiVersion": "v1",
    "label": "ReplicationController",
    "labelKey": "public~ReplicationController",
    "plural": "replicationcontrollers",
    "abbr": "RC",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "ReplicationController",
    "id": "replicationcontroller",
    "labelPlural": "ReplicationControllers",
    "labelPluralKey": "public~ReplicationControllers",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "rc"
    ],
    "color": "#004080"
  },
  "ingress.operator.openshift.io~v1~DNSRecord": {
    "kind": "DNSRecord",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "DNSRecord",
    "plural": "dnsrecords",
    "apiVersion": "v1",
    "abbr": "DNSR",
    "apiGroup": "ingress.operator.openshift.io",
    "labelPlural": "DNSRecords",
    "path": "dnsrecords",
    "id": "dnsrecord",
    "crd": true
  },
  "authentication.k8s.io~v1~TokenReview": {
    "kind": "TokenReview",
    "namespaced": false,
    "verbs": [
      "create"
    ],
    "label": "TokenReview",
    "plural": "tokenreviews",
    "apiVersion": "v1",
    "abbr": "TR",
    "apiGroup": "authentication.k8s.io",
    "labelPlural": "TokenReviews",
    "path": "tokenreviews",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1~ServiceCA": {
    "kind": "ServiceCA",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ServiceCA",
    "plural": "servicecas",
    "apiVersion": "v1",
    "abbr": "SCA",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "ServiceCAs",
    "path": "servicecas",
    "id": "serviceca",
    "crd": true
  },
  "samples.operator.openshift.io~v1~Config": {
    "kind": "Config",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Config",
    "plural": "configs",
    "apiVersion": "v1",
    "abbr": "C",
    "apiGroup": "samples.operator.openshift.io",
    "labelPlural": "Configs",
    "path": "configs",
    "id": "config",
    "crd": true
  },
  "machineconfiguration.openshift.io~v1~MachineConfig": {
    "label": "MachineConfig",
    "labelKey": "public~MachineConfig",
    "labelPlural": "MachineConfigs",
    "labelPluralKey": "public~MachineConfigs",
    "apiVersion": "v1",
    "apiGroup": "machineconfiguration.openshift.io",
    "plural": "machineconfigs",
    "abbr": "MC",
    "namespaced": false,
    "kind": "MachineConfig",
    "id": "machineconfigpool",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "mc"
    ]
  },
  "snapshot.storage.k8s.io~v1beta1~VolumeSnapshot": {
    "kind": "VolumeSnapshot",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "vs"
    ],
    "label": "VolumeSnapshot",
    "plural": "volumesnapshots",
    "apiVersion": "v1beta1",
    "abbr": "VS",
    "apiGroup": "snapshot.storage.k8s.io",
    "labelPlural": "VolumeSnapshots",
    "path": "volumesnapshots",
    "id": "volumesnapshot",
    "crd": true
  },
  "Route": {
    "label": "Route",
    "labelKey": "public~Route",
    "labelPlural": "Routes",
    "labelPluralKey": "public~Routes",
    "apiGroup": "route.openshift.io",
    "apiVersion": "v1",
    "plural": "routes",
    "abbr": "RT",
    "namespaced": true,
    "kind": "Route",
    "id": "route",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "console.openshift.io~v1~ConsoleCLIDownload": {
    "label": "ConsoleCLIDownload",
    "labelKey": "public~ConsoleCLIDownload",
    "labelPlural": "ConsoleCLIDownloads",
    "labelPluralKey": "public~ConsoleCLIDownloads",
    "apiVersion": "v1",
    "apiGroup": "console.openshift.io",
    "plural": "consoleclidownloads",
    "abbr": "CCD",
    "namespaced": false,
    "kind": "ConsoleCLIDownload",
    "id": "consoleclidownload",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "tuned.openshift.io~v1~Tuned": {
    "kind": "Tuned",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Tuned",
    "plural": "tuneds",
    "apiVersion": "v1",
    "abbr": "T",
    "apiGroup": "tuned.openshift.io",
    "labelPlural": "Tuneds",
    "path": "tuneds",
    "id": "tuned",
    "crd": true
  },
  "apiregistration.k8s.io~v1~APIService": {
    "label": "APIService",
    "labelKey": "public~APIService",
    "labelPlural": "APIServices",
    "labelPluralKey": "APIServices",
    "apiVersion": "v1",
    "apiGroup": "apiregistration.k8s.io",
    "plural": "apiservices",
    "abbr": "APIS",
    "namespaced": false,
    "kind": "APIService",
    "id": "apiservice",
    "crd": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "network.operator.openshift.io~v1~EgressRouter": {
    "kind": "EgressRouter",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "EgressRouter",
    "plural": "egressrouters",
    "apiVersion": "v1",
    "abbr": "ER",
    "apiGroup": "network.operator.openshift.io",
    "labelPlural": "EgressRouters",
    "path": "egressrouters",
    "id": "egressrouter",
    "crd": true
  },
  "console.openshift.io~v1~ConsoleNotification": {
    "label": "ConsoleNotification",
    "labelKey": "public~ConsoleNotification",
    "labelPlural": "ConsoleNotifications",
    "labelPluralKey": "public~ConsoleNotifications",
    "apiVersion": "v1",
    "apiGroup": "console.openshift.io",
    "plural": "consolenotifications",
    "abbr": "CN",
    "namespaced": false,
    "kind": "ConsoleNotification",
    "id": "consolenotification",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "ReplicaSet": {
    "label": "ReplicaSet",
    "labelKey": "public~ReplicaSet",
    "apiVersion": "v1",
    "apiGroup": "apps",
    "plural": "replicasets",
    "abbr": "RS",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "ReplicaSet",
    "id": "replicaset",
    "labelPlural": "ReplicaSets",
    "labelPluralKey": "public~ReplicaSets",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "rs"
    ],
    "color": "#004080"
  },
  "snapshot.storage.k8s.io~v1~VolumeSnapshotClass": {
    "label": "VolumeSnapshotClass",
    "labelKey": "public~VolumeSnapshotClass",
    "apiVersion": "v1",
    "apiGroup": "snapshot.storage.k8s.io",
    "plural": "volumesnapshotclasses",
    "abbr": "VSC",
    "namespaced": false,
    "kind": "VolumeSnapshotClass",
    "id": "volumesnapshotclass",
    "labelPlural": "VolumeSnapshotClasses",
    "labelPluralKey": "public~VolumeSnapshotClasses",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "vsclass",
      "vsclasses"
    ]
  },
  "config.openshift.io~v1~OAuth": {
    "label": "OAuth",
    "labelKey": "public~OAuth",
    "labelPlural": "OAuths",
    "labelPluralKey": "public~OAuths",
    "apiVersion": "v1",
    "apiGroup": "config.openshift.io",
    "plural": "oauths",
    "abbr": "OA",
    "namespaced": false,
    "kind": "OAuth",
    "id": "oauth",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "ResourceAccessReview": {
    "label": "ResourceAccessReview",
    "labelKey": "public~ResourceAccessReview",
    "apiGroup": "authorization.openshift.io",
    "apiVersion": "v1",
    "plural": "resourceaccessreviews",
    "abbr": "LRAR",
    "namespaced": false,
    "kind": "ResourceAccessReview",
    "id": "resourceaccessreview",
    "labelPlural": "ResourceAccessReviews",
    "labelPluralKey": "public~ResourceAccessReviews",
    "verbs": [
      "create"
    ]
  },
  "config.openshift.io~v1~Console": {
    "kind": "Console",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Console",
    "plural": "consoles",
    "apiVersion": "v1",
    "abbr": "C",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Consoles",
    "path": "consoles",
    "id": "console",
    "crd": true
  },
  "ResourceQuota": {
    "label": "ResourceQuota",
    "labelKey": "public~ResourceQuota",
    "apiVersion": "v1",
    "plural": "resourcequotas",
    "abbr": "RQ",
    "namespaced": true,
    "kind": "ResourceQuota",
    "id": "resourcequota",
    "labelPlural": "ResourceQuotas",
    "labelPluralKey": "public~ResourceQuotas",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "quota"
    ]
  },
  "oauth.openshift.io~v1~OAuthClient": {
    "kind": "OAuthClient",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "OAuthClient",
    "plural": "oauthclients",
    "apiVersion": "v1",
    "abbr": "OAC",
    "apiGroup": "oauth.openshift.io",
    "labelPlural": "OAuthClients",
    "path": "oauthclients",
    "id": "",
    "crd": true
  },
  "whereabouts.cni.cncf.io~v1alpha1~IPPool": {
    "kind": "IPPool",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "IPPool",
    "plural": "ippools",
    "apiVersion": "v1alpha1",
    "abbr": "IPP",
    "apiGroup": "whereabouts.cni.cncf.io",
    "labelPlural": "IPPools",
    "path": "ippools",
    "id": "ippool",
    "crd": true
  },
  "config.openshift.io~v1~ClusterVersion": {
    "label": "ClusterVersion",
    "labelKey": "public~ClusterVersion",
    "labelPlural": "ClusterVersions",
    "labelPluralKey": "public~ClusterVersions",
    "apiVersion": "v1",
    "apiGroup": "config.openshift.io",
    "plural": "clusterversions",
    "abbr": "CV",
    "namespaced": false,
    "kind": "ClusterVersion",
    "id": "clusterversion",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "PersistentVolumeClaim": {
    "label": "PersistentVolumeClaim",
    "labelKey": "public~PersistentVolumeClaim",
    "apiVersion": "v1",
    "plural": "persistentvolumeclaims",
    "abbr": "PVC",
    "namespaced": true,
    "kind": "PersistentVolumeClaim",
    "id": "persistentvolumeclaim",
    "labelPlural": "PersistentVolumeClaims",
    "labelPluralKey": "public~PersistentVolumeClaims",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "pvc"
    ]
  },
  "monitoring.coreos.com~v1~Prometheus": {
    "kind": "Prometheus",
    "label": "Prometheus",
    "labelKey": "public~Prometheus",
    "labelPlural": "Prometheuses",
    "labelPluralKey": "public~Prometheuses",
    "apiGroup": "monitoring.coreos.com",
    "apiVersion": "v1",
    "abbr": "PI",
    "namespaced": true,
    "crd": true,
    "plural": "prometheuses",
    "propagationPolicy": "Foreground",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "authorization.openshift.io~v1~ClusterRoleBinding": {
    "kind": "ClusterRoleBinding",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update"
    ],
    "label": "ClusterRoleBinding",
    "plural": "clusterrolebindings",
    "apiVersion": "v1",
    "abbr": "CRB",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "ClusterRoleBindings",
    "path": "clusterrolebindings",
    "id": "",
    "crd": true
  },
  "snapshot.storage.k8s.io~v1~VolumeSnapshotContent": {
    "label": "VolumeSnapshotContent",
    "labelKey": "public~VolumeSnapshotContent",
    "apiVersion": "v1",
    "apiGroup": "snapshot.storage.k8s.io",
    "plural": "volumesnapshotcontents",
    "abbr": "VSC",
    "namespaced": false,
    "kind": "VolumeSnapshotContent",
    "id": "volumesnapshotcontent",
    "labelPlural": "VolumeSnapshotContents",
    "labelPluralKey": "public~VolumeSnapshotContents",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "vsc",
      "vscs"
    ]
  },
  "config.openshift.io~v1~Project": {
    "kind": "Project",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Project",
    "plural": "projects",
    "apiVersion": "v1",
    "abbr": "P",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Projects",
    "path": "projects",
    "id": "project",
    "crd": true
  },
  "discovery.k8s.io~v1~EndpointSlice": {
    "kind": "EndpointSlice",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "EndpointSlice",
    "plural": "endpointslices",
    "apiVersion": "v1",
    "abbr": "ES",
    "apiGroup": "discovery.k8s.io",
    "labelPlural": "EndpointSlices",
    "path": "endpointslices",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1~Console": {
    "label": "Console",
    "labelPlural": "Consoles",
    "apiVersion": "v1",
    "apiGroup": "operator.openshift.io",
    "plural": "consoles",
    "abbr": "C",
    "namespaced": false,
    "kind": "Console",
    "id": "console",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "authorization.openshift.io~v1~Role": {
    "kind": "Role",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update"
    ],
    "label": "Role",
    "plural": "roles",
    "apiVersion": "v1",
    "abbr": "R",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "Roles",
    "path": "roles",
    "id": "",
    "crd": true
  },
  "flowcontrol.apiserver.k8s.io~v1beta2~PriorityLevelConfiguration": {
    "kind": "PriorityLevelConfiguration",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "PriorityLevelConfiguration",
    "plural": "prioritylevelconfigurations",
    "apiVersion": "v1beta2",
    "abbr": "PLC",
    "apiGroup": "flowcontrol.apiserver.k8s.io",
    "labelPlural": "PriorityLevelConfigurations",
    "path": "prioritylevelconfigurations",
    "id": "",
    "crd": true
  },
  "operators.coreos.com~v1alpha1~CatalogSource": {
    "kind": "CatalogSource",
    "label": "CatalogSource",
    "labelKey": "olm~CatalogSource",
    "labelPlural": "CatalogSources",
    "labelPluralKey": "olm~CatalogSources",
    "apiGroup": "operators.coreos.com",
    "apiVersion": "v1alpha1",
    "abbr": "CS",
    "namespaced": true,
    "crd": true,
    "plural": "catalogsources",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "catsrc"
    ]
  },
  "operator.openshift.io~v1~Config": {
    "kind": "Config",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Config",
    "plural": "configs",
    "apiVersion": "v1",
    "abbr": "C",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "Configs",
    "path": "configs",
    "id": "config",
    "crd": true
  },
  "security.openshift.io~v1~RangeAllocation": {
    "kind": "RangeAllocation",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "RangeAllocation",
    "plural": "rangeallocations",
    "apiVersion": "v1",
    "abbr": "RA",
    "apiGroup": "security.openshift.io",
    "labelPlural": "RangeAllocations",
    "path": "rangeallocations",
    "id": "",
    "crd": true
  },
  "snapshot.storage.k8s.io~v1~VolumeSnapshot": {
    "label": "VolumeSnapshot",
    "labelKey": "public~VolumeSnapshot",
    "apiVersion": "v1",
    "apiGroup": "snapshot.storage.k8s.io",
    "plural": "volumesnapshots",
    "abbr": "VS",
    "namespaced": true,
    "kind": "VolumeSnapshot",
    "id": "volumesnapshot",
    "labelPlural": "VolumeSnapshots",
    "labelPluralKey": "public~VolumeSnapshots",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "vs"
    ]
  },
  "apps~v1~ControllerRevision": {
    "kind": "ControllerRevision",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "ControllerRevision",
    "plural": "controllerrevisions",
    "apiVersion": "v1",
    "abbr": "CR",
    "apiGroup": "apps",
    "labelPlural": "ControllerRevisions",
    "path": "controllerrevisions",
    "id": "",
    "crd": true
  },
  "config.openshift.io~v1~Scheduler": {
    "kind": "Scheduler",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Scheduler",
    "plural": "schedulers",
    "apiVersion": "v1",
    "abbr": "S",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Schedulers",
    "path": "schedulers",
    "id": "scheduler",
    "crd": true
  },
  "flowcontrol.apiserver.k8s.io~v1beta1~PriorityLevelConfiguration": {
    "kind": "PriorityLevelConfiguration",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "PriorityLevelConfiguration",
    "plural": "prioritylevelconfigurations",
    "apiVersion": "v1beta1",
    "abbr": "PLC",
    "apiGroup": "flowcontrol.apiserver.k8s.io",
    "labelPlural": "PriorityLevelConfigurations",
    "path": "prioritylevelconfigurations",
    "id": "",
    "crd": true
  },
  "Build": {
    "label": "Build",
    "labelKey": "public~Build",
    "apiVersion": "v1",
    "apiGroup": "build.openshift.io",
    "plural": "builds",
    "abbr": "B",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "Build",
    "id": "build",
    "labelPlural": "Builds",
    "labelPluralKey": "public~Builds",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "operator.openshift.io~v1~CSISnapshotController": {
    "kind": "CSISnapshotController",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "CSISnapshotController",
    "plural": "csisnapshotcontrollers",
    "apiVersion": "v1",
    "abbr": "CSIS",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "CSISnapshotControllers",
    "path": "csisnapshotcontrollers",
    "id": "csisnapshotcontroller",
    "crd": true
  },
  "machine.openshift.io~v1beta1~MachineSet": {
    "label": "MachineSet",
    "labelKey": "public~MachineSet",
    "labelPlural": "MachineSets",
    "labelPluralKey": "public~MachineSet",
    "apiVersion": "v1beta1",
    "apiGroup": "machine.openshift.io",
    "plural": "machinesets",
    "abbr": "MS",
    "namespaced": true,
    "kind": "MachineSet",
    "id": "machineset",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "imageregistry.operator.openshift.io~v1~ImagePruner": {
    "kind": "ImagePruner",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ImagePruner",
    "plural": "imagepruners",
    "apiVersion": "v1",
    "abbr": "IP",
    "apiGroup": "imageregistry.operator.openshift.io",
    "labelPlural": "ImagePruners",
    "path": "imagepruners",
    "id": "imagepruner",
    "crd": true
  },
  "config.openshift.io~v1~Image": {
    "kind": "Image",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Image",
    "plural": "images",
    "apiVersion": "v1",
    "abbr": "I",
    "apiGroup": "config.openshift.io",
    "labelPlural": "Images",
    "path": "images",
    "id": "image",
    "crd": true
  },
  "oauth.openshift.io~v1~OAuthAuthorizeToken": {
    "kind": "OAuthAuthorizeToken",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "OAuthAuthorizeToken",
    "plural": "oauthauthorizetokens",
    "apiVersion": "v1",
    "abbr": "OAAT",
    "apiGroup": "oauth.openshift.io",
    "labelPlural": "OAuthAuthorizeTokens",
    "path": "oauthauthorizetokens",
    "id": "",
    "crd": true
  },
  "RoleBinding": {
    "label": "RoleBinding",
    "labelKey": "public~RoleBinding",
    "apiGroup": "rbac.authorization.k8s.io",
    "apiVersion": "v1",
    "plural": "rolebindings",
    "abbr": "RB",
    "namespaced": true,
    "kind": "RoleBinding",
    "id": "rolebinding",
    "labelPlural": "RoleBindings",
    "labelPluralKey": "public~RoleBindings",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#008BAD"
  },
  "snapshot.storage.k8s.io~v1beta1~VolumeSnapshotClass": {
    "kind": "VolumeSnapshotClass",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "vsclass",
      "vsclasses"
    ],
    "label": "VolumeSnapshotClass",
    "plural": "volumesnapshotclasses",
    "apiVersion": "v1beta1",
    "abbr": "VSC",
    "apiGroup": "snapshot.storage.k8s.io",
    "labelPlural": "VolumeSnapshotClasses",
    "path": "volumesnapshotclasses",
    "id": "volumesnapshotclass",
    "crd": true
  },
  "oauth.openshift.io~v1~OAuthClientAuthorization": {
    "kind": "OAuthClientAuthorization",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "OAuthClientAuthorization",
    "plural": "oauthclientauthorizations",
    "apiVersion": "v1",
    "abbr": "OACA",
    "apiGroup": "oauth.openshift.io",
    "labelPlural": "OAuthClientAuthorizations",
    "path": "oauthclientauthorizations",
    "id": "",
    "crd": true
  },
  "monitoring.coreos.com~v1~Probe": {
    "kind": "Probe",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Probe",
    "plural": "probes",
    "apiVersion": "v1",
    "abbr": "P",
    "apiGroup": "monitoring.coreos.com",
    "labelPlural": "Probes",
    "path": "probes",
    "id": "probe",
    "crd": true
  },
  "CronJob": {
    "label": "CronJob",
    "labelKey": "public~CronJob",
    "apiVersion": "v1",
    "apiGroup": "batch",
    "plural": "cronjobs",
    "abbr": "CJ",
    "namespaced": true,
    "kind": "CronJob",
    "id": "cronjob",
    "labelPlural": "CronJobs",
    "labelPluralKey": "public~CronJobs",
    "propagationPolicy": "Foreground",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "cj"
    ]
  },
  "user.openshift.io~v1~User": {
    "label": "User",
    "labelKey": "public~User",
    "labelPlural": "Users",
    "labelPluralKey": "public~Users",
    "apiVersion": "v1",
    "apiGroup": "user.openshift.io",
    "plural": "users",
    "abbr": "U",
    "namespaced": false,
    "kind": "User",
    "id": "user",
    "crd": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "k8s.ovn.org~v1~EgressFirewall": {
    "kind": "EgressFirewall",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "EgressFirewall",
    "plural": "egressfirewalls",
    "apiVersion": "v1",
    "abbr": "EF",
    "apiGroup": "k8s.ovn.org",
    "labelPlural": "EgressFirewalls",
    "path": "egressfirewalls",
    "id": "egressfirewall",
    "crd": true
  },
  "ComponentStatus": {
    "apiVersion": "v1",
    "label": "ComponentStatus",
    "labelKey": "public~ComponentStatus",
    "labelPlural": "ComponentStatuses",
    "labelPluralKey": "public~ComponentStatuses",
    "plural": "componentstatuses",
    "abbr": "CS",
    "kind": "ComponentStatus",
    "id": "componentstatus",
    "verbs": [
      "get",
      "list"
    ],
    "shortNames": [
      "cs"
    ]
  },
  "TemplateInstance": {
    "label": "Template Instance",
    "apiVersion": "v1",
    "apiGroup": "template.openshift.io",
    "plural": "templateinstances",
    "abbr": "TI",
    "namespaced": true,
    "kind": "TemplateInstance",
    "id": "templateinstance",
    "labelPlural": "Template Instances",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "machineconfiguration.openshift.io~v1~KubeletConfig": {
    "kind": "KubeletConfig",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "KubeletConfig",
    "plural": "kubeletconfigs",
    "apiVersion": "v1",
    "abbr": "KC",
    "apiGroup": "machineconfiguration.openshift.io",
    "labelPlural": "KubeletConfigs",
    "path": "kubeletconfigs",
    "id": "kubeletconfig",
    "crd": true
  },
  "security.openshift.io~v1~PodSecurityPolicySelfSubjectReview": {
    "kind": "PodSecurityPolicySelfSubjectReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "PodSecurityPolicySelfSubjectReview",
    "plural": "podsecuritypolicyselfsubjectreviews",
    "apiVersion": "v1",
    "abbr": "PSPS",
    "apiGroup": "security.openshift.io",
    "labelPlural": "PodSecurityPolicySelfSubjectReviews",
    "path": "podsecuritypolicyselfsubjectreviews",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1~OpenShiftAPIServer": {
    "kind": "OpenShiftAPIServer",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "OpenShiftAPIServer",
    "plural": "openshiftapiservers",
    "apiVersion": "v1",
    "abbr": "OSAP",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "OpenShiftAPIServers",
    "path": "openshiftapiservers",
    "id": "openshiftapiserver",
    "crd": true
  },
  "config.openshift.io~v1~Infrastructure": {
    "label": "Infrastructure",
    "labelKey": "public~Infrastructure",
    "labelPlural": "Infrastructures",
    "labelPluralKey": "public~Infrastructures",
    "apiVersion": "v1",
    "apiGroup": "config.openshift.io",
    "plural": "infrastructures",
    "abbr": "INF",
    "namespaced": false,
    "kind": "Infrastructure",
    "id": "infrastructure",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "ClusterRole": {
    "label": "ClusterRole",
    "labelKey": "public~ClusterRole",
    "apiGroup": "rbac.authorization.k8s.io",
    "apiVersion": "v1",
    "plural": "clusterroles",
    "abbr": "CR",
    "kind": "ClusterRole",
    "id": "clusterrole",
    "labelPlural": "ClusterRoles",
    "labelPluralKey": "public~ClusterRoles",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#795600"
  },
  "snapshot.storage.k8s.io~v1beta1~VolumeSnapshotContent": {
    "kind": "VolumeSnapshotContent",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "vsc",
      "vscs"
    ],
    "label": "VolumeSnapshotContent",
    "plural": "volumesnapshotcontents",
    "apiVersion": "v1beta1",
    "abbr": "VSC",
    "apiGroup": "snapshot.storage.k8s.io",
    "labelPlural": "VolumeSnapshotContents",
    "path": "volumesnapshotcontents",
    "id": "volumesnapshotcontent",
    "crd": true
  },
  "console.openshift.io~v1~ConsoleYAMLSample": {
    "label": "ConsoleYAMLSample",
    "labelKey": "public~ConsoleYAMLSample",
    "labelPlural": "ConsoleYAMLSamples",
    "labelPluralKey": "public~ConsoleYAMLSamples",
    "apiVersion": "v1",
    "apiGroup": "console.openshift.io",
    "plural": "consoleyamlsamples",
    "abbr": "CYS",
    "namespaced": false,
    "kind": "ConsoleYAMLSample",
    "id": "consoleyamlsample",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "config.openshift.io~v1~APIServer": {
    "kind": "APIServer",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "APIServer",
    "plural": "apiservers",
    "apiVersion": "v1",
    "abbr": "APIS",
    "apiGroup": "config.openshift.io",
    "labelPlural": "APIServers",
    "path": "apiservers",
    "id": "apiserver",
    "crd": true
  },
  "Secret": {
    "apiVersion": "v1",
    "label": "Secret",
    "labelKey": "public~Secret",
    "plural": "secrets",
    "abbr": "S",
    "namespaced": true,
    "kind": "Secret",
    "id": "secret",
    "labelPlural": "Secrets",
    "labelPluralKey": "public~Secrets",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#C46100"
  },
  "BuildConfig": {
    "label": "BuildConfig",
    "labelKey": "public~BuildConfig",
    "apiVersion": "v1",
    "apiGroup": "build.openshift.io",
    "plural": "buildconfigs",
    "abbr": "BC",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "BuildConfig",
    "id": "buildconfig",
    "labelPlural": "BuildConfigs",
    "labelPluralKey": "public~BuildConfigs",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "bc"
    ]
  },
  "operator.openshift.io~v1~Storage": {
    "kind": "Storage",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Storage",
    "plural": "storages",
    "apiVersion": "v1",
    "abbr": "S",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "Storages",
    "path": "storages",
    "id": "storage",
    "crd": true
  },
  "monitoring.coreos.com~v1~ThanosRuler": {
    "kind": "ThanosRuler",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ThanosRuler",
    "plural": "thanosrulers",
    "apiVersion": "v1",
    "abbr": "TR",
    "apiGroup": "monitoring.coreos.com",
    "labelPlural": "ThanosRulers",
    "path": "thanosrulers",
    "id": "thanosruler",
    "crd": true
  },
  "networking.k8s.io~v1~IngressClass": {
    "kind": "IngressClass",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "IngressClass",
    "plural": "ingressclasses",
    "apiVersion": "v1",
    "abbr": "IC",
    "apiGroup": "networking.k8s.io",
    "labelPlural": "IngressClasses",
    "path": "ingressclasses",
    "id": "",
    "crd": true
  },
  "PersistentVolume": {
    "label": "PersistentVolume",
    "labelKey": "public~PersistentVolume",
    "apiVersion": "v1",
    "plural": "persistentvolumes",
    "abbr": "PV",
    "kind": "PersistentVolume",
    "id": "persistentvolume",
    "labelPlural": "PersistentVolumes",
    "labelPluralKey": "public~PersistentVolumes",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "pv"
    ]
  },
  "k8s.cni.cncf.io~v1~NetworkAttachmentDefinition": {
    "label": "Network Attachment Definition",
    "labelPlural": "Network Attachment Definitions",
    "apiVersion": "v1",
    "apiGroup": "k8s.cni.cncf.io",
    "plural": "network-attachment-definitions",
    "namespaced": true,
    "abbr": "NAD",
    "kind": "NetworkAttachmentDefinition",
    "id": "network-attachment-definition",
    "crd": true,
    "legacyPluralURL": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "net-attach-def"
    ]
  },
  "storage.k8s.io~v1beta1~CSIStorageCapacity": {
    "kind": "CSIStorageCapacity",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "CSIStorageCapacity",
    "plural": "csistoragecapacities",
    "apiVersion": "v1beta1",
    "abbr": "CSIS",
    "apiGroup": "storage.k8s.io",
    "labelPlural": "CSIStorageCapacities",
    "path": "csistoragecapacities",
    "id": "",
    "crd": true
  },
  "admissionregistration.k8s.io~v1~ValidatingWebhookConfiguration": {
    "kind": "ValidatingWebhookConfiguration",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "ValidatingWebhookConfiguration",
    "plural": "validatingwebhookconfigurations",
    "apiVersion": "v1",
    "abbr": "VWC",
    "apiGroup": "admissionregistration.k8s.io",
    "labelPlural": "ValidatingWebhookConfigurations",
    "path": "validatingwebhookconfigurations",
    "id": "",
    "crd": true
  },
  "config.openshift.io~v1~ClusterOperator": {
    "label": "ClusterOperator",
    "labelKey": "public~ClusterOperator",
    "labelPlural": "ClusterOperators",
    "labelPluralKey": "public~ClusterOperators",
    "apiVersion": "v1",
    "apiGroup": "config.openshift.io",
    "plural": "clusteroperators",
    "abbr": "CO",
    "namespaced": false,
    "kind": "ClusterOperator",
    "id": "clusteroperator",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "co"
    ]
  },
  "image.openshift.io~v1~ImageSignature": {
    "kind": "ImageSignature",
    "namespaced": false,
    "verbs": [
      "create",
      "delete"
    ],
    "label": "ImageSignature",
    "plural": "imagesignatures",
    "apiVersion": "v1",
    "abbr": "IS",
    "apiGroup": "image.openshift.io",
    "labelPlural": "ImageSignatures",
    "path": "imagesignatures",
    "id": "",
    "crd": true
  },
  "migration.k8s.io~v1alpha1~StorageVersionMigration": {
    "kind": "StorageVersionMigration",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "StorageVersionMigration",
    "plural": "storageversionmigrations",
    "apiVersion": "v1alpha1",
    "abbr": "SVM",
    "apiGroup": "migration.k8s.io",
    "labelPlural": "StorageVersionMigrations",
    "path": "storageversionmigrations",
    "id": "storageversionmigration",
    "crd": true
  },
  "cloud.network.openshift.io~v1~CloudPrivateIPConfig": {
    "kind": "CloudPrivateIPConfig",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "CloudPrivateIPConfig",
    "plural": "cloudprivateipconfigs",
    "apiVersion": "v1",
    "abbr": "CPIP",
    "apiGroup": "cloud.network.openshift.io",
    "labelPlural": "CloudPrivateIPConfigs",
    "path": "cloudprivateipconfigs",
    "id": "cloudprivateipconfig",
    "crd": true
  },
  "operator.openshift.io~v1~ClusterCSIDriver": {
    "kind": "ClusterCSIDriver",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ClusterCSIDriver",
    "plural": "clustercsidrivers",
    "apiVersion": "v1",
    "abbr": "CCSI",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "ClusterCSIDrivers",
    "path": "clustercsidrivers",
    "id": "clustercsidriver",
    "crd": true
  },
  "CustomResourceDefinition": {
    "label": "CustomResourceDefinition",
    "labelKey": "public~CustomResourceDefinition",
    "apiGroup": "apiextensions.k8s.io",
    "apiVersion": "v1",
    "abbr": "CRD",
    "namespaced": false,
    "plural": "customresourcedefinitions",
    "kind": "CustomResourceDefinition",
    "id": "customresourcedefinition",
    "labelPlural": "CustomResourceDefinitions",
    "labelPluralKey": "public~CustomResourceDefinitions",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "crd",
      "crds"
    ]
  },
  "operator.openshift.io~v1~KubeStorageVersionMigrator": {
    "kind": "KubeStorageVersionMigrator",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "KubeStorageVersionMigrator",
    "plural": "kubestorageversionmigrators",
    "apiVersion": "v1",
    "abbr": "KSVM",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "KubeStorageVersionMigrators",
    "path": "kubestorageversionmigrators",
    "id": "kubestorageversionmigrator",
    "crd": true
  },
  "events.k8s.io~v1~Event": {
    "kind": "Event",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ev"
    ],
    "label": "Event",
    "plural": "events",
    "apiVersion": "v1",
    "abbr": "E",
    "apiGroup": "events.k8s.io",
    "labelPlural": "Events",
    "path": "events",
    "id": "",
    "crd": true
  },
  "monitoring.coreos.com~v1~Alertmanager": {
    "kind": "Alertmanager",
    "label": "Alertmanager",
    "labelKey": "public~Alertmanager",
    "labelPlural": "Alertmanagers",
    "labelPluralKey": "public~Alertmanagers",
    "apiGroup": "monitoring.coreos.com",
    "apiVersion": "v1",
    "abbr": "AM",
    "namespaced": true,
    "crd": true,
    "plural": "alertmanagers",
    "propagationPolicy": "Foreground",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "authorization.openshift.io~v1~SubjectAccessReview": {
    "kind": "SubjectAccessReview",
    "namespaced": false,
    "verbs": [
      "create"
    ],
    "label": "SubjectAccessReview",
    "plural": "subjectaccessreviews",
    "apiVersion": "v1",
    "abbr": "SAR",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "SubjectAccessReviews",
    "path": "subjectaccessreviews",
    "id": "",
    "crd": true
  },
  "authorization.openshift.io~v1~RoleBindingRestriction": {
    "kind": "RoleBindingRestriction",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "RoleBindingRestriction",
    "plural": "rolebindingrestrictions",
    "apiVersion": "v1",
    "abbr": "RBR",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "RoleBindingRestrictions",
    "path": "rolebindingrestrictions",
    "id": "",
    "crd": true
  },
  "image.openshift.io~v1~ImageTag": {
    "kind": "ImageTag",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update"
    ],
    "shortNames": [
      "itag"
    ],
    "label": "ImageTag",
    "plural": "imagetags",
    "apiVersion": "v1",
    "abbr": "IT",
    "apiGroup": "image.openshift.io",
    "labelPlural": "ImageTags",
    "path": "imagetags",
    "id": "",
    "crd": true
  },
  "policy~v1beta1~PodSecurityPolicy": {
    "kind": "PodSecurityPolicy",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "psp"
    ],
    "label": "PodSecurityPolicy",
    "plural": "podsecuritypolicies",
    "apiVersion": "v1beta1",
    "abbr": "PSP",
    "apiGroup": "policy",
    "labelPlural": "PodSecurityPolicies",
    "path": "podsecuritypolicies",
    "id": "",
    "crd": true
  },
  "authorization.openshift.io~v1~LocalSubjectAccessReview": {
    "kind": "LocalSubjectAccessReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "LocalSubjectAccessReview",
    "plural": "localsubjectaccessreviews",
    "apiVersion": "v1",
    "abbr": "LSAR",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "LocalSubjectAccessReviews",
    "path": "localsubjectaccessreviews",
    "id": "",
    "crd": true
  },
  "batch~v1beta1~CronJob": {
    "kind": "CronJob",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "cj"
    ],
    "label": "CronJob",
    "plural": "cronjobs",
    "apiVersion": "v1beta1",
    "abbr": "CJ",
    "apiGroup": "batch",
    "labelPlural": "CronJobs",
    "path": "cronjobs",
    "id": "",
    "crd": true
  },
  "discovery.k8s.io~v1beta1~EndpointSlice": {
    "kind": "EndpointSlice",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "EndpointSlice",
    "plural": "endpointslices",
    "apiVersion": "v1beta1",
    "abbr": "ES",
    "apiGroup": "discovery.k8s.io",
    "labelPlural": "EndpointSlices",
    "path": "endpointslices",
    "id": "",
    "crd": true
  },
  "machine.openshift.io~v1beta1~Machine": {
    "label": "Machine",
    "labelKey": "public~Machine",
    "labelPlural": "Machines",
    "labelPluralKey": "public~Machines",
    "apiVersion": "v1beta1",
    "apiGroup": "machine.openshift.io",
    "plural": "machines",
    "abbr": "M",
    "namespaced": true,
    "kind": "Machine",
    "id": "machine",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "config.openshift.io~v1~FeatureGate": {
    "kind": "FeatureGate",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "FeatureGate",
    "plural": "featuregates",
    "apiVersion": "v1",
    "abbr": "FG",
    "apiGroup": "config.openshift.io",
    "labelPlural": "FeatureGates",
    "path": "featuregates",
    "id": "featuregate",
    "crd": true
  },
  "console.openshift.io~v1~ConsoleQuickStart": {
    "kind": "ConsoleQuickStart",
    "label": "ConsoleQuickStart",
    "labelPlural": "ConsoleQuickStarts",
    "apiGroup": "console.openshift.io",
    "apiVersion": "v1",
    "abbr": "CQS",
    "namespaced": false,
    "crd": true,
    "plural": "consolequickstarts",
    "propagationPolicy": "Background",
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "coordination.k8s.io~v1~Lease": {
    "kind": "Lease",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "Lease",
    "plural": "leases",
    "apiVersion": "v1",
    "abbr": "L",
    "apiGroup": "coordination.k8s.io",
    "labelPlural": "Leases",
    "path": "leases",
    "id": "",
    "crd": true
  },
  "image.openshift.io~v1~ImageStreamImage": {
    "kind": "ImageStreamImage",
    "namespaced": true,
    "verbs": [
      "get"
    ],
    "shortNames": [
      "isimage"
    ],
    "label": "ImageStreamImage",
    "plural": "imagestreamimages",
    "apiVersion": "v1",
    "abbr": "ISI",
    "apiGroup": "image.openshift.io",
    "labelPlural": "ImageStreamImages",
    "path": "imagestreamimages",
    "id": "",
    "crd": true
  },
  "console.openshift.io~v1~ConsoleExternalLogLink": {
    "label": "ConsoleExternalLogLink",
    "labelKey": "public~ConsoleExternalLogLink",
    "labelPlural": "ConsoleExternalLogLinks",
    "labelPluralKey": "public~ConsoleExternalLogLinks",
    "apiVersion": "v1",
    "apiGroup": "console.openshift.io",
    "plural": "consoleexternalloglinks",
    "abbr": "CELL",
    "namespaced": false,
    "kind": "ConsoleExternalLogLink",
    "id": "consoleexternalloglink",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "LocalResourceAccessReview": {
    "label": "LocalResourceAccessReview",
    "labelKey": "public~LocalResourceAccessReview",
    "apiGroup": "authorization.openshift.io",
    "apiVersion": "v1",
    "plural": "localresourceaccessreviews",
    "abbr": "LRAR",
    "namespaced": true,
    "kind": "LocalResourceAccessReview",
    "id": "localresourceaccessreview",
    "labelPlural": "LocalResourceAccessReviews",
    "labelPluralKey": "public~LocalResourceAccessReviews",
    "verbs": [
      "create"
    ]
  },
  "Ingress": {
    "label": "Ingress",
    "labelKey": "public~Ingress",
    "labelPlural": "Ingresses",
    "labelPluralKey": "public~Ingresses",
    "apiGroup": "networking.k8s.io",
    "apiVersion": "v1",
    "plural": "ingresses",
    "abbr": "I",
    "namespaced": true,
    "kind": "Ingress",
    "id": "ingress",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ing"
    ],
    "color": "#1F0066"
  },
  "Service": {
    "apiVersion": "v1",
    "label": "Service",
    "labelKey": "public~Service",
    "plural": "services",
    "abbr": "S",
    "namespaced": true,
    "kind": "Service",
    "id": "service",
    "labelPlural": "Services",
    "labelPluralKey": "public~Services",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "svc"
    ],
    "color": "#3E8635"
  },
  "ClusterRoleBinding": {
    "label": "ClusterRoleBinding",
    "labelKey": "public~ClusterRoleBinding",
    "apiGroup": "rbac.authorization.k8s.io",
    "apiVersion": "v1",
    "plural": "clusterrolebindings",
    "abbr": "CRB",
    "kind": "ClusterRoleBinding",
    "id": "clusterrolebinding",
    "labelPlural": "ClusterRoleBindings",
    "labelPluralKey": "public~ClusterRoleBindings",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#008BAD"
  },
  "storage.k8s.io~v1~CSINode": {
    "kind": "CSINode",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "CSINode",
    "plural": "csinodes",
    "apiVersion": "v1",
    "abbr": "CSIN",
    "apiGroup": "storage.k8s.io",
    "labelPlural": "CSINodes",
    "path": "csinodes",
    "id": "",
    "crd": true
  },
  "operators.coreos.com~v1alpha2~OperatorGroup": {
    "kind": "OperatorGroup",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "og"
    ],
    "label": "OperatorGroup",
    "plural": "operatorgroups",
    "apiVersion": "v1alpha2",
    "abbr": "OG",
    "apiGroup": "operators.coreos.com",
    "labelPlural": "OperatorGroups",
    "path": "operatorgroups",
    "id": "operatorgroup",
    "crd": true
  },
  "monitoring.coreos.com~v1~PodMonitor": {
    "kind": "PodMonitor",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "PodMonitor",
    "plural": "podmonitors",
    "apiVersion": "v1",
    "abbr": "PM",
    "apiGroup": "monitoring.coreos.com",
    "labelPlural": "PodMonitors",
    "path": "podmonitors",
    "id": "podmonitor",
    "crd": true
  },
  "Role": {
    "label": "Role",
    "labelKey": "public~Role",
    "apiGroup": "rbac.authorization.k8s.io",
    "apiVersion": "v1",
    "plural": "roles",
    "abbr": "R",
    "namespaced": true,
    "kind": "Role",
    "id": "role",
    "labelPlural": "Roles",
    "labelPluralKey": "public~Roles",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#795600"
  },
  "operators.coreos.com~v1alpha1~ClusterServiceVersion": {
    "kind": "ClusterServiceVersion",
    "label": "ClusterServiceVersion",
    "labelKey": "olm~ClusterServiceVersion",
    "labelPlural": "ClusterServiceVersions",
    "labelPluralKey": "olm~ClusterServiceVersions",
    "apiGroup": "operators.coreos.com",
    "apiVersion": "v1alpha1",
    "abbr": "CSV",
    "namespaced": true,
    "crd": true,
    "plural": "clusterserviceversions",
    "propagationPolicy": "Foreground",
    "legacyPluralURL": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "csv",
      "csvs"
    ]
  },
  "security.openshift.io~v1~SecurityContextConstraints": {
    "kind": "SecurityContextConstraints",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "scc"
    ],
    "label": "SecurityContextConstraints",
    "plural": "securitycontextconstraints",
    "apiVersion": "v1",
    "abbr": "SCC",
    "apiGroup": "security.openshift.io",
    "labelPlural": "SecurityContextConstraints",
    "path": "securitycontextconstraints",
    "id": "",
    "crd": true
  },
  "ProjectRequest": {
    "apiVersion": "v1",
    "apiGroup": "project.openshift.io",
    "label": "ProjectRequest",
    "labelKey": "public~ProjectRequest",
    "plural": "projectrequests",
    "abbr": "",
    "kind": "ProjectRequest",
    "id": "projectrequest",
    "labelPlural": "ProjectRequests",
    "labelPluralKey": "public~ProjectRequests",
    "verbs": [
      "create",
      "list"
    ]
  },
  "StatefulSet": {
    "label": "StatefulSet",
    "labelKey": "public~StatefulSet",
    "apiGroup": "apps",
    "apiVersion": "v1",
    "plural": "statefulsets",
    "abbr": "SS",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "StatefulSet",
    "id": "statefulset",
    "labelPlural": "StatefulSets",
    "labelPluralKey": "public~StatefulSets",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "sts"
    ]
  },
  "flows.netobserv.io~v1alpha1~FlowCollector": {
    "kind": "FlowCollector",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "FlowCollector",
    "plural": "flowcollectors",
    "apiVersion": "v1alpha1",
    "abbr": "FC",
    "apiGroup": "flows.netobserv.io",
    "labelPlural": "FlowCollectors",
    "path": "flowcollectors",
    "id": "flowcollector",
    "crd": true
  },
  "migration.k8s.io~v1alpha1~StorageState": {
    "kind": "StorageState",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "StorageState",
    "plural": "storagestates",
    "apiVersion": "v1alpha1",
    "abbr": "SS",
    "apiGroup": "migration.k8s.io",
    "labelPlural": "StorageStates",
    "path": "storagestates",
    "id": "storagestate",
    "crd": true
  },
  "k8s.ovn.org~v1~EgressIP": {
    "kind": "EgressIP",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "eip"
    ],
    "label": "EgressIP",
    "plural": "egressips",
    "apiVersion": "v1",
    "abbr": "EIP",
    "apiGroup": "k8s.ovn.org",
    "labelPlural": "EgressIPs",
    "path": "egressips",
    "id": "egressip",
    "crd": true
  },
  "metal3.io~v1alpha1~FirmwareSchema": {
    "kind": "FirmwareSchema",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "FirmwareSchema",
    "plural": "firmwareschemas",
    "apiVersion": "v1alpha1",
    "abbr": "FS",
    "apiGroup": "metal3.io",
    "labelPlural": "FirmwareSchemas",
    "path": "firmwareschemas",
    "id": "firmwareschema",
    "crd": true
  },
  "oauth.openshift.io~v1~OAuthAccessToken": {
    "kind": "OAuthAccessToken",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "OAuthAccessToken",
    "plural": "oauthaccesstokens",
    "apiVersion": "v1",
    "abbr": "OAAT",
    "apiGroup": "oauth.openshift.io",
    "labelPlural": "OAuthAccessTokens",
    "path": "oauthaccesstokens",
    "id": "",
    "crd": true
  },
  "cloudcredential.openshift.io~v1~CredentialsRequest": {
    "kind": "CredentialsRequest",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "CredentialsRequest",
    "plural": "credentialsrequests",
    "apiVersion": "v1",
    "abbr": "CR",
    "apiGroup": "cloudcredential.openshift.io",
    "labelPlural": "CredentialsRequests",
    "path": "credentialsrequests",
    "id": "credentialsrequest",
    "crd": true
  },
  "quota.openshift.io~v1~AppliedClusterResourceQuota": {
    "label": "AppliedClusterResourceQuota",
    "labelKey": "public~AppliedClusterResourceQuota",
    "apiGroup": "quota.openshift.io",
    "apiVersion": "v1",
    "plural": "appliedclusterresourcequotas",
    "abbr": "ACRQ",
    "namespaced": true,
    "kind": "AppliedClusterResourceQuota",
    "id": "appliedclusterresourcequota",
    "labelPlural": "AppliedClusterResourceQuotas",
    "labelPluralKey": "public~AppliedClusterResourceQuotas",
    "crd": true,
    "verbs": [
      "get",
      "list"
    ]
  },
  "imageregistry.operator.openshift.io~v1~Config": {
    "kind": "Config",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Config",
    "plural": "configs",
    "apiVersion": "v1",
    "abbr": "C",
    "apiGroup": "imageregistry.operator.openshift.io",
    "labelPlural": "Configs",
    "path": "configs",
    "id": "config",
    "crd": true
  },
  "authorization.k8s.io~v1~SelfSubjectRulesReview": {
    "kind": "SelfSubjectRulesReview",
    "namespaced": false,
    "verbs": [
      "create"
    ],
    "label": "SelfSubjectRulesReview",
    "plural": "selfsubjectrulesreviews",
    "apiVersion": "v1",
    "abbr": "SSRR",
    "apiGroup": "authorization.k8s.io",
    "labelPlural": "SelfSubjectRulesReviews",
    "path": "selfsubjectrulesreviews",
    "id": "",
    "crd": true
  },
  "HorizontalPodAutoscaler": {
    "label": "HorizontalPodAutoscaler",
    "labelKey": "public~HorizontalPodAutoscaler",
    "plural": "horizontalpodautoscalers",
    "apiVersion": "v2beta2",
    "apiGroup": "autoscaling",
    "abbr": "HPA",
    "namespaced": true,
    "kind": "HorizontalPodAutoscaler",
    "id": "horizontalpodautoscaler",
    "labelPlural": "HorizontalPodAutoscalers",
    "labelPluralKey": "public~HorizontalPodAutoscalers",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "hpa"
    ]
  },
  "ServiceAccount": {
    "apiVersion": "v1",
    "label": "ServiceAccount",
    "labelKey": "public~ServiceAccount",
    "plural": "serviceaccounts",
    "abbr": "SA",
    "namespaced": true,
    "kind": "ServiceAccount",
    "id": "serviceaccount",
    "labelPlural": "ServiceAccounts",
    "labelPluralKey": "public~ServiceAccounts",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "sa"
    ],
    "color": "#40199A"
  },
  "machine.openshift.io~v1beta1~MachineHealthCheck": {
    "label": "MachineHealthCheck",
    "labelKey": "public~MachineHealthCheck",
    "labelPlural": "MachineHealthChecks",
    "labelPluralKey": "public~MachineHealthChecks",
    "apiVersion": "v1beta1",
    "apiGroup": "machine.openshift.io",
    "plural": "machinehealthchecks",
    "abbr": "MHC",
    "namespaced": true,
    "kind": "MachineHealthCheck",
    "id": "machinehealthcheck",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "mhc",
      "mhcs"
    ]
  },
  "operators.coreos.com~v1~OLMConfig": {
    "kind": "OLMConfig",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "OLMConfig",
    "plural": "olmconfigs",
    "apiVersion": "v1",
    "abbr": "OLMC",
    "apiGroup": "operators.coreos.com",
    "labelPlural": "OLMConfigs",
    "path": "olmconfigs",
    "id": "olmconfig",
    "crd": true
  },
  "oauth.openshift.io~v1~TokenReview": {
    "kind": "TokenReview",
    "namespaced": false,
    "verbs": [
      "create"
    ],
    "label": "TokenReview",
    "plural": "tokenreviews",
    "apiVersion": "v1",
    "abbr": "TR",
    "apiGroup": "oauth.openshift.io",
    "labelPlural": "TokenReviews",
    "path": "tokenreviews",
    "id": "",
    "crd": true
  },
  "operator.openshift.io~v1~KubeControllerManager": {
    "kind": "KubeControllerManager",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "KubeControllerManager",
    "plural": "kubecontrollermanagers",
    "apiVersion": "v1",
    "abbr": "KCM",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "KubeControllerManagers",
    "path": "kubecontrollermanagers",
    "id": "kubecontrollermanager",
    "crd": true
  },
  "policy~v1beta1~PodDisruptionBudget": {
    "kind": "PodDisruptionBudget",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "pdb"
    ],
    "label": "PodDisruptionBudget",
    "plural": "poddisruptionbudgets",
    "apiVersion": "v1beta1",
    "abbr": "PDB",
    "apiGroup": "policy",
    "labelPlural": "PodDisruptionBudgets",
    "path": "poddisruptionbudgets",
    "id": "",
    "crd": true
  },
  "autoscaling~v2beta1~HorizontalPodAutoscaler": {
    "kind": "HorizontalPodAutoscaler",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "hpa"
    ],
    "label": "HorizontalPodAutoscaler",
    "plural": "horizontalpodautoscalers",
    "apiVersion": "v2beta1",
    "abbr": "HPA",
    "apiGroup": "autoscaling",
    "labelPlural": "HorizontalPodAutoscalers",
    "path": "horizontalpodautoscalers",
    "id": "",
    "crd": true
  },
  "authorization.openshift.io~v1~RoleBinding": {
    "kind": "RoleBinding",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update"
    ],
    "label": "RoleBinding",
    "plural": "rolebindings",
    "apiVersion": "v1",
    "abbr": "RB",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "RoleBindings",
    "path": "rolebindings",
    "id": "",
    "crd": true
  },
  "metal3.io~v1alpha1~BMCEventSubscription": {
    "kind": "BMCEventSubscription",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "bes",
      "bmcevent"
    ],
    "label": "BMCEventSubscription",
    "plural": "bmceventsubscriptions",
    "apiVersion": "v1alpha1",
    "abbr": "BMCE",
    "apiGroup": "metal3.io",
    "labelPlural": "BMCEventSubscriptions",
    "path": "bmceventsubscriptions",
    "id": "bmceventsubscription",
    "crd": true
  },
  "authorization.openshift.io~v1~SubjectRulesReview": {
    "kind": "SubjectRulesReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "SubjectRulesReview",
    "plural": "subjectrulesreviews",
    "apiVersion": "v1",
    "abbr": "SRR",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "SubjectRulesReviews",
    "path": "subjectrulesreviews",
    "id": "",
    "crd": true
  },
  "console.openshift.io~v1~ConsoleLink": {
    "label": "ConsoleLink",
    "labelKey": "public~ConsoleLink",
    "labelPlural": "ConsoleLinks",
    "labelPluralKey": "public~ConsoleLinks",
    "apiVersion": "v1",
    "apiGroup": "console.openshift.io",
    "plural": "consolelinks",
    "abbr": "CL",
    "namespaced": false,
    "kind": "ConsoleLink",
    "id": "consolelink",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ]
  },
  "machineconfiguration.openshift.io~v1~ContainerRuntimeConfig": {
    "kind": "ContainerRuntimeConfig",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "ctrcfg"
    ],
    "label": "ContainerRuntimeConfig",
    "plural": "containerruntimeconfigs",
    "apiVersion": "v1",
    "abbr": "CRC",
    "apiGroup": "machineconfiguration.openshift.io",
    "labelPlural": "ContainerRuntimeConfigs",
    "path": "containerruntimeconfigs",
    "id": "containerruntimeconfig",
    "crd": true
  },
  "security.internal.openshift.io~v1~RangeAllocation": {
    "kind": "RangeAllocation",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "RangeAllocation",
    "plural": "rangeallocations",
    "apiVersion": "v1",
    "abbr": "RA",
    "apiGroup": "security.internal.openshift.io",
    "labelPlural": "RangeAllocations",
    "path": "rangeallocations",
    "id": "rangeallocation",
    "crd": true
  },
  "Project": {
    "apiVersion": "v1",
    "apiGroup": "project.openshift.io",
    "label": "Project",
    "labelKey": "public~Project",
    "plural": "projects",
    "abbr": "PR",
    "kind": "Project",
    "id": "project",
    "labelPlural": "Projects",
    "labelPluralKey": "public~Projects",
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#1E4F18"
  },
  "autoscaling.openshift.io~v1~ClusterAutoscaler": {
    "label": "ClusterAutoscaler",
    "labelKey": "public~ClusterAutoscaler",
    "labelPlural": "ClusterAutoscalers",
    "labelPluralKey": "public~ClusterAutoscalers",
    "apiVersion": "v1",
    "apiGroup": "autoscaling.openshift.io",
    "plural": "clusterautoscalers",
    "abbr": "CA",
    "namespaced": false,
    "kind": "ClusterAutoscaler",
    "id": "clusterautoscaler",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "ca"
    ]
  },
  "Template": {
    "label": "Template",
    "labelKey": "public~Template",
    "apiVersion": "v1",
    "apiGroup": "template.openshift.io",
    "plural": "templates",
    "abbr": "T",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "Template",
    "id": "template",
    "labelPlural": "Templates",
    "labelPluralKey": "public~Templates",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "core~v1~Endpoints": {
    "kind": "Endpoints",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ep"
    ],
    "label": "Endpoints",
    "plural": "endpoints",
    "apiVersion": "v1",
    "abbr": "E",
    "labelPlural": "Endpoints",
    "path": "endpoints",
    "id": "",
    "crd": true
  },
  "packages.operators.coreos.com~v1~PackageManifest": {
    "kind": "PackageManifest",
    "label": "PackageManifest",
    "labelKey": "olm~PackageManifest",
    "labelPlural": "PackageManifests",
    "labelPluralKey": "olm~PackageManifests",
    "apiGroup": "packages.operators.coreos.com",
    "apiVersion": "v1",
    "abbr": "PM",
    "namespaced": true,
    "crd": true,
    "plural": "packagemanifests",
    "verbs": [
      "get",
      "list"
    ]
  },
  "authorization.openshift.io~v1~ClusterRole": {
    "kind": "ClusterRole",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update"
    ],
    "label": "ClusterRole",
    "plural": "clusterroles",
    "apiVersion": "v1",
    "abbr": "CR",
    "apiGroup": "authorization.openshift.io",
    "labelPlural": "ClusterRoles",
    "path": "clusterroles",
    "id": "",
    "crd": true
  },
  "Event": {
    "apiVersion": "v1",
    "label": "Event",
    "labelKey": "public~Event",
    "plural": "events",
    "abbr": "E",
    "namespaced": true,
    "kind": "Event",
    "id": "event",
    "labelPlural": "Events",
    "labelPluralKey": "public~Events",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ev"
    ]
  },
  "ConfigMap": {
    "apiVersion": "v1",
    "label": "ConfigMap",
    "labelKey": "public~ConfigMap",
    "plural": "configmaps",
    "abbr": "CM",
    "namespaced": true,
    "kind": "ConfigMap",
    "id": "configmap",
    "labelPlural": "ConfigMaps",
    "labelPluralKey": "public~ConfigMaps",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "cm"
    ],
    "color": "#40199A"
  },
  "whereabouts.cni.cncf.io~v1alpha1~OverlappingRangeIPReservation": {
    "kind": "OverlappingRangeIPReservation",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "OverlappingRangeIPReservation",
    "plural": "overlappingrangeipreservations",
    "apiVersion": "v1alpha1",
    "abbr": "ORIP",
    "apiGroup": "whereabouts.cni.cncf.io",
    "labelPlural": "OverlappingRangeIPReservations",
    "path": "overlappingrangeipreservations",
    "id": "overlappingrangeipreservation",
    "crd": true
  },
  "autoscaling.openshift.io~v1beta1~MachineAutoscaler": {
    "label": "MachineAutoscaler",
    "labelKey": "public~MachineAutoscaler",
    "labelPlural": "MachineAutoscalers",
    "labelPluralKey": "public~MachineAutoscalers",
    "apiVersion": "v1beta1",
    "apiGroup": "autoscaling.openshift.io",
    "plural": "machineautoscalers",
    "abbr": "MA",
    "namespaced": true,
    "kind": "MachineAutoscaler",
    "id": "machineautoscaler",
    "crd": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "ma"
    ]
  },
  "operator.openshift.io~v1~Etcd": {
    "kind": "Etcd",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Etcd",
    "plural": "etcds",
    "apiVersion": "v1",
    "abbr": "E",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "Etcds",
    "path": "etcds",
    "id": "etcd",
    "crd": true
  },
  "storage.k8s.io~v1~CSIDriver": {
    "label": "CSIDriver",
    "labelKey": "public~CSIDriver",
    "labelPlural": "CSIDrivers",
    "labelPluralKey": "public~CSIDrivers",
    "apiVersion": "v1",
    "apiGroup": "storage.k8s.io",
    "plural": "csidrivers",
    "abbr": "CSI",
    "namespaced": false,
    "kind": "CSIDriver",
    "id": "csidriver",
    "crd": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "user.openshift.io~v1~Group": {
    "label": "Group",
    "labelKey": "public~Group",
    "labelPlural": "Groups",
    "labelPluralKey": "public~Groups",
    "apiVersion": "v1",
    "apiGroup": "user.openshift.io",
    "plural": "groups",
    "abbr": "G",
    "namespaced": false,
    "kind": "Group",
    "id": "group",
    "crd": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ]
  },
  "ImageStream": {
    "label": "ImageStream",
    "labelKey": "public~ImageStream",
    "apiVersion": "v1",
    "apiGroup": "image.openshift.io",
    "plural": "imagestreams",
    "abbr": "IS",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "ImageStream",
    "id": "imagestream",
    "labelPlural": "ImageStreams",
    "labelPluralKey": "public~ImageStreams",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "is"
    ]
  },
  "metrics.k8s.io~v1beta1~PodMetrics": {
    "kind": "PodMetrics",
    "namespaced": true,
    "verbs": [
      "get",
      "list"
    ],
    "label": "PodMetrics",
    "plural": "pods",
    "apiVersion": "v1beta1",
    "abbr": "PM",
    "apiGroup": "metrics.k8s.io",
    "labelPlural": "PodMetrics",
    "path": "pods",
    "id": "",
    "crd": true
  },
  "Namespace": {
    "apiVersion": "v1",
    "label": "Namespace",
    "labelKey": "public~Namespace",
    "plural": "namespaces",
    "abbr": "NS",
    "kind": "Namespace",
    "id": "namespace",
    "labelPlural": "Namespaces",
    "labelPluralKey": "public~Namespaces",
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ns"
    ],
    "color": "#1E4F18"
  },
  "autoscaling~v1~HorizontalPodAutoscaler": {
    "kind": "HorizontalPodAutoscaler",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "hpa"
    ],
    "label": "HorizontalPodAutoscaler",
    "plural": "horizontalpodautoscalers",
    "apiVersion": "v1",
    "abbr": "HPA",
    "apiGroup": "autoscaling",
    "labelPlural": "HorizontalPodAutoscalers",
    "path": "horizontalpodautoscalers",
    "id": "",
    "crd": true
  },
  "helm.openshift.io~v1beta1~ProjectHelmChartRepository": {
    "kind": "ProjectHelmChartRepository",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Project Helm Chart Repository",
    "plural": "projecthelmchartrepositories",
    "apiVersion": "v1beta1",
    "abbr": "PHCR",
    "apiGroup": "helm.openshift.io",
    "labelPlural": "Project Helm Chart Repositories",
    "path": "projecthelmchartrepositories",
    "id": "projecthelmchartrepository",
    "crd": true
  },
  "core~v1~PodTemplate": {
    "kind": "PodTemplate",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "PodTemplate",
    "plural": "podtemplates",
    "apiVersion": "v1",
    "abbr": "PT",
    "labelPlural": "PodTemplates",
    "path": "podtemplates",
    "id": "",
    "crd": true
  },
  "config.openshift.io~v1~DNS": {
    "kind": "DNS",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "DNS",
    "plural": "dnses",
    "apiVersion": "v1",
    "abbr": "DNS",
    "apiGroup": "config.openshift.io",
    "labelPlural": "DNS",
    "path": "dnses",
    "id": "dns",
    "crd": true
  },
  "node.k8s.io~v1beta1~RuntimeClass": {
    "kind": "RuntimeClass",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "RuntimeClass",
    "plural": "runtimeclasses",
    "apiVersion": "v1beta1",
    "abbr": "RC",
    "apiGroup": "node.k8s.io",
    "labelPlural": "RuntimeClasses",
    "path": "runtimeclasses",
    "id": "",
    "crd": true
  },
  "SelfSubjectAccessReview": {
    "label": "SelfSubjectAccessReview",
    "labelKey": "public~SelfSubjectAccessReview",
    "apiGroup": "authorization.k8s.io",
    "apiVersion": "v1",
    "plural": "selfsubjectaccessreviews",
    "abbr": "SSAR",
    "namespaced": true,
    "kind": "SelfSubjectAccessReview",
    "id": "selfsubjectaccessreview",
    "labelPlural": "SelfSubjectAccessReviews",
    "labelPluralKey": "public~SelfSubjectAccessReviews",
    "verbs": [
      "create"
    ]
  },
  "autoscaling~v2~HorizontalPodAutoscaler": {
    "kind": "HorizontalPodAutoscaler",
    "namespaced": true,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "hpa"
    ],
    "label": "HorizontalPodAutoscaler",
    "plural": "horizontalpodautoscalers",
    "apiVersion": "v2",
    "abbr": "HPA",
    "apiGroup": "autoscaling",
    "labelPlural": "HorizontalPodAutoscalers",
    "path": "horizontalpodautoscalers",
    "id": "",
    "crd": true
  },
  "security.openshift.io~v1~PodSecurityPolicySubjectReview": {
    "kind": "PodSecurityPolicySubjectReview",
    "namespaced": true,
    "verbs": [
      "create"
    ],
    "label": "PodSecurityPolicySubjectReview",
    "plural": "podsecuritypolicysubjectreviews",
    "apiVersion": "v1",
    "abbr": "PSPS",
    "apiGroup": "security.openshift.io",
    "labelPlural": "PodSecurityPolicySubjectReviews",
    "path": "podsecuritypolicysubjectreviews",
    "id": "",
    "crd": true
  },
  "PodDisruptionBudget": {
    "label": "PodDisruptionBudget",
    "labelKey": "console-app~PodDisruptionBudget",
    "labelPlural": "PodDisruptionBudgets",
    "labelPluralKey": "console-app~PodDisruptionBudgets",
    "plural": "poddisruptionbudgets",
    "apiVersion": "v1",
    "apiGroup": "policy",
    "abbr": "PDB",
    "namespaced": true,
    "kind": "PodDisruptionBudget",
    "id": "poddisruptionbudget",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "pdb"
    ]
  },
  "operators.coreos.com~v1~OperatorCondition": {
    "kind": "OperatorCondition",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "condition"
    ],
    "label": "OperatorCondition",
    "plural": "operatorconditions",
    "apiVersion": "v1",
    "abbr": "OC",
    "apiGroup": "operators.coreos.com",
    "labelPlural": "OperatorConditions",
    "path": "operatorconditions",
    "id": "operatorcondition",
    "crd": true
  },
  "config.openshift.io~v1~ImageContentPolicy": {
    "kind": "ImageContentPolicy",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ImageContentPolicy",
    "plural": "imagecontentpolicies",
    "apiVersion": "v1",
    "abbr": "ICP",
    "apiGroup": "config.openshift.io",
    "labelPlural": "ImageContentPolicies",
    "path": "imagecontentpolicies",
    "id": "imagecontentpolicy",
    "crd": true
  },
  "operators.coreos.com~v1alpha1~InstallPlan": {
    "kind": "InstallPlan",
    "label": "InstallPlan",
    "labelKey": "olm~InstallPlan",
    "labelPlural": "InstallPlans",
    "labelPluralKey": "olm~InstallPlans",
    "apiGroup": "operators.coreos.com",
    "apiVersion": "v1alpha1",
    "abbr": "IP",
    "namespaced": true,
    "crd": true,
    "plural": "installplans",
    "legacyPluralURL": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "ip"
    ]
  },
  "template.openshift.io~v1~BrokerTemplateInstance": {
    "kind": "BrokerTemplateInstance",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "BrokerTemplateInstance",
    "plural": "brokertemplateinstances",
    "apiVersion": "v1",
    "abbr": "BTI",
    "apiGroup": "template.openshift.io",
    "labelPlural": "BrokerTemplateInstances",
    "path": "brokertemplateinstances",
    "id": "",
    "crd": true
  },
  "Job": {
    "label": "Job",
    "labelKey": "public~Job",
    "apiVersion": "v1",
    "apiGroup": "batch",
    "plural": "jobs",
    "abbr": "J",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "Job",
    "id": "job",
    "labelPlural": "Jobs",
    "labelPluralKey": "public~Jobs",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "color": "#004080"
  },
  "StorageClass": {
    "label": "StorageClass",
    "labelKey": "public~StorageClass",
    "labelPlural": "StorageClasses",
    "labelPluralKey": "public~StorageClasses",
    "apiVersion": "v1",
    "apiGroup": "storage.k8s.io",
    "plural": "storageclasses",
    "abbr": "SC",
    "namespaced": false,
    "kind": "StorageClass",
    "id": "storageclass",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "sc"
    ]
  },
  "operator.openshift.io~v1~DNS": {
    "kind": "DNS",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "DNS",
    "plural": "dnses",
    "apiVersion": "v1",
    "abbr": "DNS",
    "apiGroup": "operator.openshift.io",
    "labelPlural": "DNS",
    "path": "dnses",
    "id": "dns",
    "crd": true
  },
  "operators.coreos.com~v2~OperatorCondition": {
    "kind": "OperatorCondition",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "shortNames": [
      "condition"
    ],
    "label": "OperatorCondition",
    "plural": "operatorconditions",
    "apiVersion": "v2",
    "abbr": "OC",
    "apiGroup": "operators.coreos.com",
    "labelPlural": "OperatorConditions",
    "path": "operatorconditions",
    "id": "operatorcondition",
    "crd": true
  },
  "operators.coreos.com~v1~Operator": {
    "kind": "Operator",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "Operator",
    "plural": "operators",
    "apiVersion": "v1",
    "abbr": "O",
    "apiGroup": "operators.coreos.com",
    "labelPlural": "Operators",
    "path": "operators",
    "id": "operator",
    "crd": true
  },
  "machineconfiguration.openshift.io~v1~ControllerConfig": {
    "kind": "ControllerConfig",
    "namespaced": false,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "ControllerConfig",
    "plural": "controllerconfigs",
    "apiVersion": "v1",
    "abbr": "CC",
    "apiGroup": "machineconfiguration.openshift.io",
    "labelPlural": "ControllerConfigs",
    "path": "controllerconfigs",
    "id": "controllerconfig",
    "crd": true
  },
  "DaemonSet": {
    "label": "DaemonSet",
    "labelKey": "public~DaemonSet",
    "apiGroup": "apps",
    "plural": "daemonsets",
    "apiVersion": "v1",
    "abbr": "DS",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "DaemonSet",
    "id": "daemonset",
    "labelPlural": "DaemonSets",
    "labelPluralKey": "public~DaemonSets",
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "shortNames": [
      "ds"
    ],
    "color": "#004080"
  },
  "network.operator.openshift.io~v1~OperatorPKI": {
    "kind": "OperatorPKI",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "OperatorPKI",
    "plural": "operatorpkis",
    "apiVersion": "v1",
    "abbr": "OPKI",
    "apiGroup": "network.operator.openshift.io",
    "labelPlural": "OperatorPKIs",
    "path": "operatorpkis",
    "id": "operatorpki",
    "crd": true
  },
  "ImageStreamTag": {
    "label": "ImageStreamTag",
    "labelKey": "public~ImageStreamTag",
    "apiVersion": "v1",
    "apiGroup": "image.openshift.io",
    "plural": "imagestreamtags",
    "abbr": "IST",
    "namespaced": true,
    "propagationPolicy": "Foreground",
    "kind": "ImageStreamTag",
    "id": "imagestreamtag",
    "labelPlural": "ImageStreamTags",
    "labelPluralKey": "public~ImageStreamTags",
    "verbs": [
      "create",
      "delete",
      "get",
      "list",
      "patch",
      "update"
    ],
    "shortNames": [
      "istag"
    ]
  },
  "node.k8s.io~v1~RuntimeClass": {
    "kind": "RuntimeClass",
    "namespaced": false,
    "verbs": [
      "create",
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "update",
      "watch"
    ],
    "label": "RuntimeClass",
    "plural": "runtimeclasses",
    "apiVersion": "v1",
    "abbr": "RC",
    "apiGroup": "node.k8s.io",
    "labelPlural": "RuntimeClasses",
    "path": "runtimeclasses",
    "id": "",
    "crd": true
  },
  "controlplane.operator.openshift.io~v1alpha1~PodNetworkConnectivityCheck": {
    "kind": "PodNetworkConnectivityCheck",
    "namespaced": true,
    "verbs": [
      "delete",
      "deletecollection",
      "get",
      "list",
      "patch",
      "create",
      "update",
      "watch"
    ],
    "label": "PodNetworkConnectivityCheck",
    "plural": "podnetworkconnectivitychecks",
    "apiVersion": "v1alpha1",
    "abbr": "PNCC",
    "apiGroup": "controlplane.operator.openshift.io",
    "labelPlural": "PodNetworkConnectivityChecks",
    "path": "podnetworkconnectivitychecks",
    "id": "podnetworkconnectivitycheck",
    "crd": true
  }
};