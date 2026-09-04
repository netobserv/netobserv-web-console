import { fireEvent, render } from '@testing-library/react';
import * as React from 'react';
import { ContextSingleton } from '../../../../utils/context';
import { PromQLEditor } from '../promql-editor';
import { PROMQL_SNIPPETS } from '../promql-snippets';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

jest.mock('../../../../utils/theme-hook', () => ({
  useTheme: () => false
}));

jest.mock('@patternfly/react-code-editor', () => ({
  Language: { plaintext: 'plaintext' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CodeEditor: ({ code, onChange, isReadOnly, id }: any) => (
    <textarea
      data-test={id || 'mock-code-editor'}
      value={code}
      readOnly={Boolean(isReadOnly)}
      onChange={e => onChange?.(e.target.value)}
    />
  )
}));

jest.mock('monaco-promql', () => ({
  promLanguageDefinition: { id: 'promql', loader: () => Promise.resolve({}) }
}));

describe('PromQLEditor', () => {
  const originalOpen = window.open;

  beforeEach(() => {
    window.open = jest.fn();
  });

  afterEach(() => {
    window.open = originalOpen;
    jest.restoreAllMocks();
  });

  it('shows Run query in plugin mode', () => {
    jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(false);
    const { container } = render(<PromQLEditor id="promql-editor" value="up" onChange={jest.fn()} />);
    expect(container.querySelector('[data-test="promql-editor-run-query"]')).toBeTruthy();
  });

  it('hides Run query in standalone mode', () => {
    jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(true);
    const { container } = render(<PromQLEditor id="promql-editor" value="up" onChange={jest.fn()} />);
    expect(container.querySelector('[data-test="promql-editor-run-query"]')).toBeNull();
  });

  it('inserts a snippet into the editor value', () => {
    jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(true);
    const onChange = jest.fn();
    const { container, getByText } = render(<PromQLEditor id="promql-editor" value="" onChange={onChange} />);
    fireEvent.click(container.querySelector('[data-test="promql-editor-snippets-toggle"]') as HTMLElement);
    const snippet = PROMQL_SNIPPETS[0];
    fireEvent.click(getByText(snippet.label));
    expect(onChange).toHaveBeenCalledWith(snippet.expr);
  });

  it('disables snippet dropdown in read-only mode', () => {
    jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(true);
    const { container } = render(<PromQLEditor id="promql-editor" value="up" onChange={jest.fn()} isReadOnly />);
    const toggle = container.querySelector('[data-test="promql-editor-snippets-toggle"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(toggle.disabled || toggle.getAttribute('aria-disabled') === 'true').toBe(true);
  });
});
