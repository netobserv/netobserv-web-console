#!/usr/bin/env bash

fcSchema=`kubectl get crd flowcollectors.flows.netobserv.io -ojsonpath='{.spec.versions[0].schema.openAPIV3Schema}' | jq`
fcsSchema=`kubectl get crd flowcollectorslices.flows.netobserv.io -ojsonpath='{.spec.versions[0].schema.openAPIV3Schema}' | jq`
fmSchema=`kubectl get crd flowmetrics.flows.netobserv.io -ojsonpath='{.spec.versions[0].schema.openAPIV3Schema}' | jq`
date=`LC_ALL=en_US.utf8 date`

cat <<EOF > web/pluginToStandaloneMapper/schemas.ts
// Auto-generated on ${date} by scripts/generate-schemas.sh ; DO NOT EDIT (edit the script instead).
// File only used in tests or dev console

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-len */
import { RJSFSchema } from '@rjsf/utils';

// flowCollectorSchema is only used in tests or dev console
export const flowCollectorSchema: RJSFSchema | any = ${fcSchema};

// flowCollectorSliceSchema is only used in tests or dev console
export const flowCollectorSliceSchema: RJSFSchema | any = ${fcsSchema};

// flowMetricSchema is only used in tests or dev console
export const flowMetricSchema: RJSFSchema | any = ${fmSchema};
EOF
