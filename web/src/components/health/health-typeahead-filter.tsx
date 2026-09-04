import { Menu, MenuContent, MenuItem, MenuList, Popper, TextInput, ValidatedOptions } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { validateK8SName } from '../../utils/label';
import { useOutsideClickEvent } from '../../utils/outside-hook';
import { matchesNamespacePattern } from './health-filters';
import './health-typeahead-filter.css';

export interface HealthTypeaheadFilterOption {
  value: string;
  label: string;
}

export interface HealthTypeaheadFilterProps {
  id: string;
  toggleLabel: string;
  options: HealthTypeaheadFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

// Cap the suggestion list: the namespace count can be large, and suggestions are only a convenience
// (the user can always type a pattern and press Enter without picking one).
const MAX_SUGGESTIONS = 10;

// Free-text namespace filter for the Network Health page, mirroring the Network Traffic UX: the user
// types a name or a pattern and presses Enter to add it as a filter value; matching namespaces are
// suggested below the input but picking one is optional (it just fills an exact value). No checkbox
// step, so `openshift-*` filters every openshift namespace in one go. Selected values are rendered as
// chips by the toolbar; a value can be a partial name, a "quoted" exact name, or a `*` wildcard.
export const HealthTypeaheadFilter: React.FC<HealthTypeaheadFilterProps> = ({
  id,
  toggleLabel,
  options,
  selected,
  onChange
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [inputValue, setInputValue] = React.useState('');
  const [isOpen, setOpen] = React.useState(false);
  const containerRef = useOutsideClickEvent(() => setOpen(false));
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const query = inputValue.trim();
  // Reuse the exact validation the Network Traffic namespace filter applies (label.ts): allows
  // partial names, `*` wildcards and "quoted" exact matches, rejects anything else.
  const isValid = !query || validateK8SName(query);

  // Suggestions are the known namespaces matching what's typed, minus the ones already added.
  const suggestions = React.useMemo(
    () =>
      query && isValid
        ? options.filter(opt => !selected.includes(opt.value) && matchesNamespacePattern(inputValue, opt.value))
        : [],
    [options, selected, inputValue, query, isValid]
  );
  const shownSuggestions = suggestions.slice(0, MAX_SUGGESTIONS);

  const addValue = React.useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value || !validateK8SName(value)) {
        return;
      }
      if (!selected.includes(value)) {
        onChange([...selected, value]);
      }
      setInputValue('');
      setOpen(false);
      inputRef.current?.focus();
    },
    [selected, onChange]
  );

  const onSelectSuggestion = (_e: React.MouseEvent | undefined, itemId: string | number | undefined) => {
    if (itemId !== undefined) {
      addValue(String(itemId));
    }
  };

  return (
    <div id={`${id}-container`} data-test={`${id}-container`} ref={containerRef} className="health-typeahead">
      <Popper
        trigger={
          <TextInput
            type="search"
            id={`${id}-input`}
            data-test={`${id}-input`}
            role="combobox"
            aria-label={toggleLabel}
            aria-controls={`${id}-listbox`}
            aria-expanded={isOpen}
            aria-autocomplete="list"
            placeholder={toggleLabel}
            value={inputValue}
            validated={isValid ? ValidatedOptions.default : ValidatedOptions.warning}
            onFocus={() => setOpen(true)}
            onChange={(_e, value) => {
              setInputValue(value);
              setOpen(true);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addValue(inputValue);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            ref={inputRef}
          />
        }
        popper={
          <Menu id={`${id}-listbox`} onSelect={onSelectSuggestion} isScrollable>
            <MenuContent>
              <MenuList>
                {!query ? (
                  <MenuItem isDisabled key="hint" data-test={`${id}-hint`}>
                    <div className="health-typeahead-hints">
                      <div className="health-typeahead-hints__title">
                        {t('Type a name or pattern, then press Enter')}
                      </div>
                      <div>{t('Partial match, e.g. monitoring')}</div>
                      <div>{t('Exact match with quotes, e.g. "openshift-dns"')}</div>
                      <div>{t('Starts with, e.g. openshift-*')}</div>
                      <div>{t('Ends with, e.g. *-system')}</div>
                      <div>{t('Pattern, e.g. openshift-*-operator')}</div>
                    </div>
                  </MenuItem>
                ) : !isValid ? (
                  <MenuItem isDisabled key="invalid" data-test={`${id}-invalid`}>
                    {t('Not a valid Kubernetes name')}
                  </MenuItem>
                ) : (
                  <>
                    {shownSuggestions.map(opt => (
                      <MenuItem
                        key={opt.value}
                        itemId={opt.value}
                        data-test={`${id}-option-${opt.value}`}
                        id={`${id}-option-${opt.value}`}
                      >
                        {opt.label}
                      </MenuItem>
                    ))}
                    {suggestions.length > MAX_SUGGESTIONS && (
                      <MenuItem isDisabled key="more" data-test={`${id}-more`}>
                        {t('{{count}} more matching namespaces…', {
                          count: suggestions.length - MAX_SUGGESTIONS
                        })}
                      </MenuItem>
                    )}
                    <MenuItem isDisabled key="enter-hint" data-test={`${id}-enter-hint`}>
                      <div className="health-typeahead-note">
                        {shownSuggestions.length === 0
                          ? t('No matching namespaces — press Enter to filter by this pattern')
                          : t('Press Enter to filter by this pattern, or pick a namespace above')}
                      </div>
                    </MenuItem>
                  </>
                )}
              </MenuList>
            </MenuContent>
          </Menu>
        }
        isVisible={isOpen}
        enableFlip={false}
        appendTo={containerRef.current || undefined}
      />
    </div>
  );
};

export default HealthTypeaheadFilter;
