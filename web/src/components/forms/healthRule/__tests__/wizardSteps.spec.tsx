import { fireEvent, render } from '@testing-library/react';
import * as React from 'react';
import { defaultWizardState, WizardState } from '../types';
import { SourceModeStep } from '../wizardSteps';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

/** PatternFly Radio puts data-test on the <input> itself. */
const radioInput = (container: HTMLElement, testId: string): HTMLInputElement => {
  const el = container.querySelector(`[data-test="${testId}"]`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`expected input [data-test="${testId}"], got ${el?.outerHTML?.slice(0, 120) ?? 'null'}`);
  }
  return el;
};

const SourceModeStepHarness: React.FC<{ lockSource?: boolean; initial?: WizardState }> = ({
  lockSource,
  initial = defaultWizardState()
}) => {
  const [state, setState] = React.useState(initial);
  return (
    <div data-test="harness" data-source={state.source} data-mode={state.mode}>
      <SourceModeStep state={state} onChange={setState} lockSource={lockSource} />
    </div>
  );
};

describe('SourceModeStep', () => {
  it('defaults to template selection', () => {
    const { container } = render(<SourceModeStepHarness />);
    expect(radioInput(container, 'health-rule-source-template').checked).toBe(true);
    expect(radioInput(container, 'health-rule-source-alert').checked).toBe(false);
    expect(radioInput(container, 'health-rule-source-recording').checked).toBe(false);
  });

  it('selecting Alert updates source, mode, template.mode, and custom.mode', () => {
    const onChange = jest.fn();
    const { container } = render(<SourceModeStep state={defaultWizardState()} onChange={onChange} />);

    fireEvent.click(radioInput(container, 'health-rule-source-alert'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'custom',
        mode: 'Alert',
        template: expect.objectContaining({ mode: 'Alert' }),
        custom: expect.objectContaining({ mode: 'Alert' })
      })
    );
  });

  it('selecting Recording updates source, mode, template.mode, and custom.mode', () => {
    const onChange = jest.fn();
    const { container } = render(<SourceModeStep state={defaultWizardState()} onChange={onChange} />);

    fireEvent.click(radioInput(container, 'health-rule-source-recording'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'custom',
        mode: 'Recording',
        template: expect.objectContaining({ mode: 'Recording' }),
        custom: expect.objectContaining({ mode: 'Recording' })
      })
    );
  });

  it('selecting template from a custom mode preserves template.mode when already set', () => {
    const onChange = jest.fn();
    const state: WizardState = {
      ...defaultWizardState(),
      source: 'custom',
      mode: 'Recording',
      template: { ...defaultWizardState().template, mode: 'Alert' },
      custom: { ...defaultWizardState().custom, mode: 'Recording' }
    };
    const { container } = render(<SourceModeStep state={state} onChange={onChange} />);

    fireEvent.click(radioInput(container, 'health-rule-source-template'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'template',
        mode: 'Recording',
        template: expect.objectContaining({ mode: 'Alert' }),
        custom: expect.objectContaining({ mode: 'Recording' })
      })
    );
  });

  it('disables radios and preserves selection when lockSource is set', () => {
    const state: WizardState = {
      ...defaultWizardState(),
      source: 'custom',
      mode: 'Recording'
    };
    const { container } = render(<SourceModeStep state={state} onChange={jest.fn()} lockSource />);

    expect(radioInput(container, 'health-rule-source-template').disabled).toBe(true);
    expect(radioInput(container, 'health-rule-source-alert').disabled).toBe(true);
    expect(radioInput(container, 'health-rule-source-recording').disabled).toBe(true);
    expect(radioInput(container, 'health-rule-source-recording').checked).toBe(true);
  });

  it('keeps selection in sync across transitions in a controlled harness', () => {
    const { container } = render(<SourceModeStepHarness />);

    fireEvent.click(radioInput(container, 'health-rule-source-recording'));
    expect(radioInput(container, 'health-rule-source-recording').checked).toBe(true);
    expect(container.querySelector('[data-test="harness"]')?.getAttribute('data-source')).toBe('custom');
    expect(container.querySelector('[data-test="harness"]')?.getAttribute('data-mode')).toBe('Recording');

    fireEvent.click(radioInput(container, 'health-rule-source-template'));
    expect(radioInput(container, 'health-rule-source-template').checked).toBe(true);
    expect(container.querySelector('[data-test="harness"]')?.getAttribute('data-source')).toBe('template');
  });
});
