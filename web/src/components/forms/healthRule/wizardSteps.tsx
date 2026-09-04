import { Form, FormGroup, Radio } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { HealthRuleMode, HealthRuleSource, WizardState } from './types';

export type SourceModeStepProps = {
  state: WizardState;
  onChange: (next: WizardState) => void;
  lockSource?: boolean;
};

type RuleChoice = 'template' | 'alert' | 'recording';

const choiceFromState = (state: WizardState): RuleChoice => {
  if (state.source === 'template') {
    return 'template';
  }
  return state.mode === 'Recording' ? 'recording' : 'alert';
};

/**
 * Step 1: choose NetObserv template, custom Alert, or custom Recording rule.
 * Mode for custom paths is fixed here; template mode stays on the configuration form.
 */
export const SourceModeStep: React.FC<SourceModeStepProps> = ({ state, onChange, lockSource }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const choice = choiceFromState(state);

  const setChoice = (next: RuleChoice) => {
    if (next === 'template') {
      onChange({
        ...state,
        source: 'template',
        template: { ...state.template, mode: state.template.mode || state.mode },
        custom: { ...state.custom, mode: state.mode }
      });
      return;
    }
    const mode: HealthRuleMode = next === 'recording' ? 'Recording' : 'Alert';
    onChange({
      ...state,
      source: 'custom',
      mode,
      template: { ...state.template, mode },
      custom: { ...state.custom, mode }
    });
  };

  return (
    <>
      <span className="co-pre-line">
        {t(
          // eslint-disable-next-line max-len
          'Network Health rules define how NetObserv detects and displays network issues. They can generate Prometheus alerts (with notifications) or recording rules (dashboard only).'
        )}
        <br />
        <br />
        {t(
          // eslint-disable-next-line max-len
          'This wizard helps you create or customize a health rule. Prefer a NetObserv template when possible: templates reuse built-in PromQL and only need thresholds or scopes. Choose a custom alert or recording rule when you need a query that templates do not cover.'
        )}
        <br />
        <br />
        {t(
          // eslint-disable-next-line max-len
          'After saving, it may take a short time for the rule to appear on Network Health while Prometheus reconciles.'
        )}
        <br />
        <br />
      </span>
      <Form>
        <FormGroup role="radiogroup" isStack label={t('Rule type')} isRequired fieldId="health-rule-source">
          <Radio
            id="health-rule-source-template"
            name="health-rule-source"
            data-test="health-rule-source-template"
            label={t('NetObserv template (recommended)')}
            description={t(
              // eslint-disable-next-line max-len
              'Templates configure FlowCollector healthRules without writing PromQL. Customizing a template replaces its defaults.'
            )}
            isChecked={choice === 'template'}
            isDisabled={lockSource}
            onChange={() => setChoice('template')}
          />
          <Radio
            id="health-rule-source-alert"
            name="health-rule-source"
            data-test="health-rule-source-alert"
            label={t('Alert')}
            description={t(
              // eslint-disable-next-line max-len
              'Custom Prometheus alert with notifications via Alertmanager and Network Health. Prefer a namespace other than the NetObserv install namespace.'
            )}
            isChecked={choice === 'alert'}
            isDisabled={lockSource}
            onChange={() => setChoice('alert')}
          />
          <Radio
            id="health-rule-source-recording"
            name="health-rule-source"
            data-test="health-rule-source-recording"
            label={t('Recording rule')}
            description={t(
              // eslint-disable-next-line max-len
              'Custom Prometheus recording rule for Network Health only (no Alertmanager notifications). Prefer a namespace other than the NetObserv install namespace.'
            )}
            isChecked={choice === 'recording'}
            isDisabled={lockSource}
            onChange={() => setChoice('recording')}
          />
        </FormGroup>
      </Form>
    </>
  );
};

export type ConfigStepIntroProps = {
  source: HealthRuleSource;
  mode: HealthRuleMode;
};

/** Intro copy above the configuration DynamicForm (template vs custom). */
export const ConfigStepIntro: React.FC<ConfigStepIntroProps> = ({ source, mode }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  if (source === 'template') {
    return (
      <span className="co-pre-line" style={{ display: 'block', marginBottom: '1rem' }}>
        {t(
          // eslint-disable-next-line max-len
          'Select a built-in template and optionally override its mode. Leave variants empty to keep the template defaults. Add variants when you need custom thresholds or grouping (for example per Namespace).'
        )}
        <br />
        <br />
        {t(
          // eslint-disable-next-line max-len
          'Saving updates FlowCollector.spec.processor.metrics.healthRules for this template. That replaces any previous override for the same template name.'
        )}
        <br />
        <br />
        {t('Template configuration')}
      </span>
    );
  }

  return (
    <span className="co-pre-line" style={{ display: 'block', marginBottom: '1rem' }}>
      {mode === 'Alert'
        ? t(
            // eslint-disable-next-line max-len
            'Define a Prometheus alert with PromQL. Set severity, summary, and description for Alertmanager. Optional Network Health display fields control how the rule appears on the dashboard.'
          )
        : t(
            // eslint-disable-next-line max-len
            'Define a Prometheus recording rule with PromQL. Recording rules do not notify; they feed Network Health. Summary, description, and display thresholds are stored as NetObserv metadata on the PrometheusRule.'
          )}
      <br />
      <br />
      {t(
        // eslint-disable-next-line max-len
        'The netobserv label is applied automatically. Prefer a namespace outside the NetObserv install namespace so rules are not deleted if NetObserv is uninstalled.'
      )}
      <br />
      <br />
      {t('Custom rule configuration')}
    </span>
  );
};
