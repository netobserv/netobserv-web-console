
/* eslint-env node */
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { ConsoleRemotePlugin } from '@openshift-console/dynamic-plugin-sdk-webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import * as path from 'path';

//const NodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'development',
  // No regular entry points. The remote container entry is handled by ConsoleRemotePlugin.
  entry: {},
  context: path.resolve(__dirname, 'src'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]-bundle.js',
    chunkFilename: '[name]-chunk.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /(\.jsx?)|(\.tsx?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: process.env.TRANSPILE_ONLY === 'true',
              configFile: path.resolve(__dirname, 'tsconfig.json'),
              compilerOptions: {
                sourceMap: process.env.NODE_ENV === 'development',
                incremental: true,
              },
            },
          },
        ],
      },
      {
        test: /(\.s*[ac]ss)$/,
        use: [
          // Creates `style` nodes from JS strings
          // Insert styles at top of document head using function
          // Check https://webpack.js.org/loaders/style-loader/#function
          {
            loader: "style-loader", options: {
              insert: function insertAtTop(element: any) {
                const parent = document.querySelector("head");
                // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
                const lastInsertedElement = (window as any)._lastElementInsertedByStyleLoader;

                if (!lastInsertedElement) {
                  parent!.insertBefore(element, parent!.firstChild);
                } else if (lastInsertedElement.nextSibling) {
                  parent!.insertBefore(element, lastInsertedElement.nextSibling);
                } else {
                  parent!.appendChild(element);
                }

                // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
                (window as any)._lastElementInsertedByStyleLoader = element;
              },
            }
          },
          // Translates CSS into CommonJS
          "css-loader",
        ],
      },
    ],
  },
  devServer: {
    static: './dist',
    port: 9001,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Authorization"
    },
    devMiddleware: {
      writeToDisk: true,
    },
    proxy: [
      {
        context: ['/api', '/role'],
        target: 'http://localhost:9000',
        router: () => 'http://localhost:9002',
        logLevel: 'debug' /*optional*/
      }
    ],
  },
  plugins: [
    new ConsoleRemotePlugin({
      pluginMetadata: {
        name: "netobserv-plugin",
        version: "0.1.0",
        displayName: "NetObserv Plugin for the OpenShift Console",
        description: "This plugin adds network observability views to the OpenShift Console",
        exposedModules: {
          "netflowParent": "./components/netflow-traffic-parent.tsx",
          "netflowTab": "./components/netflow-traffic-tab.tsx",
          "netflowDevTab": "./components/netflow-traffic-dev-tab.tsx",
          "networkHealth": "./components/health/network-health.tsx",
        },
      },
      extensions: [
        {
          "type": "console.flag",
          "properties": {
            "handler": { "$codeRef": "netflowTab.featureFlagHandler" }
          }
        },
        {
          type: "console.navigation/href",
          properties: {
            "id": "network-health-link",
            "perspective": "admin",
            "section": "observe",
            name: "%plugin__netobserv-plugin~Network Health%",
            "href": "/network-health"
          },
          "flags": { "required": ["CAN_LIST_NS"] }
        },
        {
          type: "console.navigation/href",
          properties: {
            "id": "netflow-traffic-link",
            "perspective": "admin",
            "section": "observe",
            name: "%plugin__netobserv-plugin~Network Traffic%",
            "href": "/netflow-traffic"
          }
        },
        {
          type: "console.navigation/href",
          properties: {
            "id": "netflow-traffic-link-projectadmin",
            "perspective": "admin",
            "section": "observe-projectadmin",
            name: "%plugin__netobserv-plugin~Network Traffic%",
            "href": "/netflow-traffic"
          },
          "flags": { "disallowed": ["CAN_LIST_NS"] }
        },
        {
          type: "console.page/route",
          properties: {
            path: "/netflow-traffic",
            component: {
              "$codeRef": "netflowParent.default"
            }
          }
        },
        {
          type: "console.page/route",
          properties: {
            path: "/network-health",
            component: {
              "$codeRef": "networkHealth.default"
            }
          },
          "flags": { "required": ["CAN_LIST_NS"] }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "",
              kind: "Pod"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          },
          "flags": { "required": ["NETOBSERV_LOKI_ENABLED"] }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "",
              kind: "Service"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          },
          "flags": { "required": ["NETOBSERV_LOKI_ENABLED"] }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "",
              kind: "Namespace"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "apps",
              kind: "Deployment"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "apps",
              kind: "StatefulSet"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "apps",
              kind: "DaemonSet"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "apps",
              kind: "ReplicaSet"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "",
              kind: "Node"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "batch",
              kind: "CronJob"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "batch",
              kind: "Job"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v2beta2",
              group: "autoscaling",
              kind: "HorizontalPodAutoscaler"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "route.openshift.io",
              kind: "Route"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "gateway.networking.k8s.io",
              kind: "Gateway"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1beta1",
              group: "gateway.networking.k8s.io",
              kind: "Gateway"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "k8s.ovn.org",
              kind: "ClusterUserDefinedNetwork"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab/horizontalNav",
          properties: {
            model: {
              version: "v1",
              group: "k8s.ovn.org",
              kind: "UserDefinedNetwork"
            },
            component: {
              "$codeRef": "netflowTab.default"
            },
            "page": {
              name: "%plugin__netobserv-plugin~Network Traffic%",
              "href": "netflow"
            }
          }
        },
        {
          type: "console.tab",
          properties: {
            "contextId": "dev-console-observe",
            name: "%plugin__netobserv-plugin~Network Traffic%",
            "href": "netflow-traffic",
            component: {
              "$codeRef": "netflowDevTab.default"
            }
          }
        }
      ],
      validateExtensionIntegrity: false // must be skipped to avoid modules not referenced error
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'locales'), to: 'locales' },
        { from: path.resolve(__dirname, 'assets'), to: 'assets' },
      ],
    }),
  ],
  devtool: 'source-map',
  optimization: {
    chunkIds: 'named',
    minimize: false,
  },
  cache: {
    type: 'filesystem',
  },
};

if (process.env.FLAVOR === 'static') {
  module.exports.output.path = path.resolve(__dirname, 'dist', 'static');
  module.exports.plugins = [
    new ConsoleRemotePlugin({
      pluginMetadata: {
        name: "netobserv-plugin-static",
        version: "0.1.0",
        displayName: "NetObserv Static Plugin for the OpenShift Console",
        description: "This plugin adds custom forms for FlowCollector, FlowCollectorSlice and FlowMetrics APIs",
        exposedModules: {
          "flowCollectorWizard": "./components/forms/flowCollector-wizard.tsx",
          "flowCollectorForm": "./components/forms/flowCollector.tsx",
          "flowCollectorStatus": "./components/forms/flowCollector-status.tsx",
          "flowCollectorSliceForm": "./components/forms/flowCollectorSlice.tsx",
          "flowMetricWizard": "./components/forms/flowMetric-wizard.tsx",
          "flowMetricForm": "./components/forms/flowMetric.tsx"
        },
      },
      extensions: [
        {
          type: "console.page/route",
          properties: {
            // add FlowCollector wizard to 'Installed Operator' -> 'Create' action
            path: "/k8s/ns/:namespace/operators.coreos.com~v1alpha1~ClusterServiceVersion/:operator/flows.netobserv.io~v1beta2~FlowCollector/~new",
            component: {
              "$codeRef": "flowCollectorWizard.default"
            }
          }
        },
        {
          type: "console.page/route",
          properties: {
            path: [
              // add FlowCollector form to standard 'New' and 'Edit' actions
              "/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/~new",
              "/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/:name"
            ],
            component: {
              "$codeRef": "flowCollectorForm.default"
            }
          }
        },
        {
          type: "console.page/route",
          properties: {
            path: "/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/status",
            component: {
              "$codeRef": "flowCollectorStatus.default"
            }
          }
        },
        {
          type: "console.page/route",
          properties: {
            path: [
              // 'Installed Operator' -> 'Create' action
              "k8s/ns/:namespace/operators.coreos.com~v1alpha1~ClusterServiceVersion/:operator/flows.netobserv.io~v1alpha1~FlowCollectorSlice/~new",
              // 'Installed Operator' -> 'Edit' action and standard 'New' and 'Edit' actions
              "/k8s/cluster/flows.netobserv.io~v1alpha1~FlowCollectorSlice/~new",
              "/k8s/ns/:namespace/clusterserviceversions/:operator/flows.netobserv.io~v1alpha1~FlowCollectorSlice/:name",
              "/k8s/ns/:namespace/flows.netobserv.io~v1alpha1~FlowCollectorSlice/~new",
              "/k8s/ns/:namespace/flows.netobserv.io~v1alpha1~FlowCollectorSlice/:name"
            ],
            component: {
              "$codeRef": "flowCollectorSliceForm.default"
            }
          }
        },
        {
          type: "console.page/route",
          properties: {
            // add FlowMetric wizard to 'Installed Operator' -> 'Create' action
            path: "k8s/ns/:namespace/operators.coreos.com~v1alpha1~ClusterServiceVersion/:operator/flows.netobserv.io~v1alpha1~FlowMetric/~new",
            component: {
              "$codeRef": "flowMetricWizard.default"
            }
          }
        },
        {
          type: "console.page/route",
          properties: {
            path: [
              // add FlowMetric form to 'Installed Operator' -> 'Edit' action and standard 'New' and 'Edit' actions
              "/k8s/cluster/flows.netobserv.io~v1alpha1~FlowMetric/~new",
              "/k8s/ns/:namespace/clusterserviceversions/:operator/flows.netobserv.io~v1alpha1~FlowMetric/:name",
              "/k8s/ns/:namespace/flows.netobserv.io~v1alpha1~FlowMetric/~new",
              "/k8s/ns/:namespace/flows.netobserv.io~v1alpha1~FlowMetric/:name"
            ],
            component: {
              "$codeRef": "flowMetricForm.default"
            }
          }
        }
      ],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'locales'), to: 'locales' },
        { from: path.resolve(__dirname, 'assets'), to: 'assets' },
      ],
    }),
  ];
}

if (process.env.NODE_ENV === 'production') {
  module.exports.mode = 'production';
  module.exports.output.filename = '[name]-bundle-[hash].min.js';
  module.exports.output.chunkFilename = '[name]-chunk-[chunkhash].min.js';
  module.exports.optimization.chunkIds = 'deterministic';
  module.exports.optimization.minimize = true;
  // Causes error in --mode=production due to scope hoisting
  module.exports.optimization.concatenateModules = false;
  // Manage dependencies from package.json file. Replace all devDependencies 'import' by 'require'
  /*module.exports.externals = NodeExternals({
    fileName: './package.json',
    includeInBundle: ['dependencies'],
    excludeFromBundle: ['devDependencies']
  });*/
}

if (process.env.TYPECHECK === 'true') {
  module.exports.plugins.push(
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: path.resolve(__dirname, 'tsconfig.json')
      }
    })
  );
}

export default module.exports;
