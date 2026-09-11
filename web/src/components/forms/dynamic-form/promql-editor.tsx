import { Monaco } from '@monaco-editor/react';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { promLanguageDefinition } from 'monaco-promql';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ContextSingleton } from '../../../utils/context';
import { useTheme } from '../../../utils/theme-hook';
import { buildMonitoringQueryBrowserPath } from './promql-query-browser';
import { NETOBSERV_METRIC_SUGGESTIONS, PROMQL_SNIPPETS } from './promql-snippets';

export type PromQLEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
  isReadOnly?: boolean;
  helperText?: string;
};

export { buildMonitoringQueryBrowserPath } from './promql-query-browser';

let promqlRegistered = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerPromQL = (monaco: Monaco) => {
  if (promqlRegistered) {
    return;
  }
  const languageId = promLanguageDefinition.id;
  monaco.languages.register(promLanguageDefinition);
  monaco.languages.onLanguage(languageId, () => {
    // monaco-promql loader returns language + providers; package ships incomplete typings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    promLanguageDefinition.loader().then((mod: any) => {
      monaco.languages.setMonarchTokensProvider(languageId, mod.language);
      monaco.languages.setLanguageConfiguration(languageId, mod.languageConfiguration);
      monaco.languages.registerCompletionItemProvider(languageId, mod.completionItemProvider);
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['_', '{', ',', '='],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          return {
            suggestions: NETOBSERV_METRIC_SUGGESTIONS.map(metric => ({
              label: metric,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: metric,
              range,
              detail: 'NetObserv metric'
            }))
          };
        }
      });
    });
  });
  promqlRegistered = true;
};

export const PromQLEditor: React.FC<PromQLEditorProps> = ({
  id = 'promql-editor',
  value,
  onChange,
  height = '180px',
  isReadOnly,
  helperText
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const canRunQuery = Boolean(value?.trim()) && !ContextSingleton.isStandalone();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEditorDidMount = React.useCallback((ed: any, monaco: Monaco) => {
    registerPromQL(monaco);
    const model = ed.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, promLanguageDefinition.id);
    }
  }, []);

  const onRunQuery = () => {
    if (!value?.trim()) {
      return;
    }
    window.open(buildMonitoringQueryBrowserPath(value), '_blank', 'noopener,noreferrer');
  };

  return (
    <div data-test={id} id={id}>
      <Flex spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <Dropdown
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setIsOpen(!isOpen)}
                isExpanded={isOpen}
                isDisabled={isReadOnly}
                variant="secondary"
                id={`${id}-snippets-toggle`}
                data-test={`${id}-snippets-toggle`}
              >
                {t('Insert example query')}
              </MenuToggle>
            )}
          >
            <DropdownList>
              {PROMQL_SNIPPETS.map(s => (
                <DropdownItem
                  key={s.id}
                  data-test={`${id}-snippet-${s.id}`}
                  ouiaId={`${id}-snippet-${s.id}`}
                  description={s.description}
                  onClick={() => {
                    onChange(s.expr);
                    setIsOpen(false);
                  }}
                >
                  {s.label}
                </DropdownItem>
              ))}
            </DropdownList>
          </Dropdown>
        </FlexItem>
        {!ContextSingleton.isStandalone() && (
          <FlexItem>
            <Button
              variant="secondary"
              icon={<ExternalLinkAltIcon />}
              iconPosition="end"
              data-test={`${id}-run-query`}
              isDisabled={!canRunQuery}
              onClick={onRunQuery}
            >
              {t('Run query')}
            </Button>
          </FlexItem>
        )}
      </Flex>
      <div style={{ marginTop: '0.5rem' }}>
        <CodeEditor
          id={`${id}-code`}
          isDarkTheme={isDarkTheme}
          isMinimapVisible={false}
          isLineNumbersVisible={true}
          isLanguageLabelVisible={false}
          isReadOnly={isReadOnly}
          code={value}
          onChange={v => onChange(v || '')}
          language={Language.plaintext}
          height={height}
          onEditorDidMount={onEditorDidMount}
        />
      </div>
      <FormHelperText>
        <HelperText>
          <HelperTextItem>
            {helperText ||
              t('PromQL with NetObserv metric suggestions. Use examples for common health-check patterns.')}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </div>
  );
};

export default PromQLEditor;
