/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Button,
  PageSection,
  Title,
  Wizard,
  WizardFooterWrapper,
  WizardStep,
  WizardStepType
} from '@patternfly/react-core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import _ from 'lodash';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiscardGuard } from '../../../utils/discard-guard-hook';
import {
  flowCollectorEditPath,
  flowCollectorNewPath,
  flowCollectorSetupPath,
  flowCollectorStatusPath,
  navigateTo,
  useNavigate,
  useParams,
  useSearchParams
} from '../../../utils/url';
import { DynamicForm } from '../dynamic-form/dynamic-form';
import { ErrorTemplate } from '../dynamic-form/templates';
import '../forms.css';
import ResourceWatcher, { Consumer } from '../resource-watcher';
import { getFilteredUISchema } from '../utils';
import Consumption from './consumption';
import { flowCollectorUISchema } from './uiSchema';

export type FlowCollectorWizardProps = {
  name?: string;
};

const defaultPaths = ['spec.namespace', 'spec.networkPolicy'];

const processingPaths = [
  'spec.deploymentModel',
  'spec.kafka.address',
  'spec.kafka.topic',
  'spec.kafka.tls',
  'spec.agent.ebpf.privileged',
  'spec.agent.ebpf.features',
  'spec.processor.clusterName',
  'spec.processor.addZone',
  'spec.processor.consumerReplicas'
];

const stepPaths: Record<string, string[]> = {
  overview: defaultPaths,
  processing: processingPaths,
  loki: ['spec.loki'],
  consumption: []
};

export const FlowCollectorWizard: FC<FlowCollectorWizardProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [schema, setSchema] = React.useState<RJSFSchema | null>(null);
  const [data, setData] = React.useState<any>(null);
  const params = useParams<{ name?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [discard, discardModal] = useDiscardGuard();
  const isSetupRoute = window.location.pathname.startsWith(flowCollectorSetupPath);

  const validSteps = Object.keys(stepPaths);
  const initialTab = searchParams.get('tab');
  const initialStepId = initialTab && validSteps.includes(initialTab) ? initialTab : 'overview';
  const [startIndex] = React.useState(validSteps.indexOf(initialStepId) + 1);
  const [paths, setPaths] = React.useState<string[]>(stepPaths[initialStepId]);
  const blockAutoRedirectToEditRef = React.useRef(false);

  React.useEffect(() => {
    blockAutoRedirectToEditRef.current = false;
  }, []);

  const submitFlowCollector = React.useCallback(
    (ctx: { onSubmit: (d: any) => void }, formData: any) => {
      blockAutoRedirectToEditRef.current = true;
      discard.clearDirty();
      ctx.onSubmit(formData);
    },
    [discard]
  );

  const form = React.useCallback(
    (errors?: string[]) => {
      if (!schema) {
        return <></>;
      }
      const filteredSchema = getFilteredUISchema(flowCollectorUISchema, paths);
      return (
        <DynamicForm
          formData={data}
          schema={schema}
          uiSchema={filteredSchema} // see if we can regenerate this from CSV
          validator={validator}
          onChange={event => {
            setData(event.formData);
            discard.markDirty();
          }}
          errors={errors}
          skipDefaults
        />
      );
    },
    [data, discard, paths, schema]
  );

  const onStepChange = React.useCallback(
    (_event: React.MouseEvent<HTMLButtonElement>, step: WizardStepType) => {
      if (step.id) {
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('tab', step.id as string);
          return newParams;
        });
        setPaths(stepPaths[step.id as string] ?? []);
      }
    },
    [setSearchParams]
  );

  const setSampling = React.useCallback(
    (sampling: number) => {
      if (!data) {
        return;
      }
      data.spec.agent.ebpf.sampling = sampling;
      setData({ ...data });
    },
    [data]
  );

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1beta2"
      kind="FlowCollector"
      name={isSetupRoute ? 'cluster' : params.name || props.name || 'cluster'}
      skipCRError
      onSuccess={() => {
        navigate(flowCollectorStatusPath);
      }}
      defaultFrom="CSVExample"
    >
      <Consumer>
        {ctx => {
          // redirect to edit page if resource already exists or is created while using the wizard
          // We can't handle edition here since this page doesn't include ResourceYAMLEditor
          // which handle reload / update buttons
          if (ctx.data.metadata?.resourceVersion && !blockAutoRedirectToEditRef.current && !isSetupRoute) {
            navigate(flowCollectorEditPath);
          }
          // first init schema & data when watch resource query got results
          if (schema == null) {
            setSchema(ctx.schema);
          }
          if (data == null) {
            // when on /setup route, use existing FC data as-is
            if (isSetupRoute || params.name === 'cluster') {
              setData(ctx.data);
            } else {
              // slightly modify default example when creating a new resource
              const updatedData = _.cloneDeep(ctx.data) as any;
              if (!updatedData.spec) {
                updatedData.spec = {};
              }
              if (!updatedData.spec.loki) {
                updatedData.spec.loki = {};
              }
              updatedData.spec.loki.mode = 'LokiStack'; // default to lokistack
              setData(updatedData);
            }
          }
          return (
            <PageSection hasBodyWrapper={false} id="pageSection">
              <div id="pageHeader">
                <Title headingLevel="h1" size="2xl">
                  {t('Network Observability FlowCollector setup')}
                </Title>
              </div>
              <div id="wizard-container">
                <Wizard
                  startIndex={startIndex}
                  onStepChange={onStepChange}
                  onSave={() => submitFlowCollector(ctx, data)}
                  onClose={() => discard.requestClose(() => navigateTo('/'))}
                >
                  <WizardStep name={t('Overview')} id="overview">
                    <span className="co-pre-line">
                      {t(
                        // eslint-disable-next-line max-len
                        'The FlowCollector resource is used to configure the Network Observability operator and its managed components. When it is created, network flows start being collected.'
                      )}
                      <br /> <br />
                      {t(
                        // eslint-disable-next-line max-len
                        'This wizard is a helper to create a first FlowCollector resource. It does not cover all the available configuration options, but only the most common ones.\nFor advanced configuration, please use YAML or the'
                      )}{' '}
                      <Button
                        id="open-flow-collector-form"
                        data-test-id="open-flow-collector-form"
                        className="no-padding"
                        variant="link"
                        onClick={() => navigateTo(flowCollectorNewPath)}
                      >
                        {t('FlowCollector form')}
                      </Button>
                      {t(
                        // eslint-disable-next-line max-len
                        ', which includes more options such as:\n- Filtering options\n- Configuring custom exporters\n- Custom labels based on IP\n- Pod identification for secondary networks\n- Performance fine-tuning\nYou can always edit a FlowCollector later when you start with the simplified configuration.'
                      )}
                      <br /> <br />
                      {t('Operator configuration')}
                    </span>
                    {form(ctx.errors)}
                  </WizardStep>
                  <WizardStep name={t('Processing')} id="processing">
                    {form(ctx.errors)}
                  </WizardStep>
                  <WizardStep name={t('Loki')} id="loki">
                    {form(ctx.errors)}
                  </WizardStep>
                  <WizardStep
                    name={t('Consumption')}
                    id="consumption"
                    footer={
                      <WizardFooterWrapper>
                        <Button
                          variant="primary"
                          data-test-id="flowcollector-wizard-consumption-submit"
                          onClick={() => submitFlowCollector(ctx, data)}
                        >
                          {t('Submit')}
                        </Button>
                        <Button
                          variant="link"
                          data-test-id="flowcollector-wizard-consumption-cancel"
                          onClick={() => discard.requestClose(() => navigateTo('/'))}
                        >
                          {t('Cancel')}
                        </Button>
                      </WizardFooterWrapper>
                    }
                  >
                    <Consumption flowCollector={data} setSampling={setSampling} />
                    <>{!_.isEmpty(ctx.errors) && <ErrorTemplate errors={ctx.errors} />}</>
                  </WizardStep>
                </Wizard>
              </div>
              {discardModal}
            </PageSection>
          );
        }}
      </Consumer>
    </ResourceWatcher>
  );
};

export default FlowCollectorWizard;
