import { Badge, MenuToggle, MenuToggleElement, Select, SelectOption } from '@patternfly/react-core';
import * as React from 'react';

export interface HealthMultiSelectFilterOption<T extends string> {
  value: T;
  label: string;
}

export interface HealthMultiSelectFilterProps<T extends string> {
  id: string;
  toggleLabel: string;
  options: HealthMultiSelectFilterOption<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
}

// Generic checkbox multi-select used for Severity / Status / Mode / Namespace filters on the Network Health page.
export const HealthMultiSelectFilter = <T extends string>({
  id,
  toggleLabel,
  options,
  selected,
  onChange
}: HealthMultiSelectFilterProps<T>) => {
  const [isOpen, setOpen] = React.useState(false);

  const onSelect = (_e: unknown, rawValue: string | number) => {
    const value = rawValue as T;
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div id={`${id}-container`} data-test={`${id}-container`}>
      <Select
        data-test={id}
        id={id}
        isOpen={isOpen}
        onOpenChange={setOpen}
        onSelect={onSelect}
        role="menu"
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            id={`${id}-toggle`}
            data-test={`${id}-toggle`}
            onClick={() => setOpen(!isOpen)}
            isExpanded={isOpen}
          >
            <>
              {toggleLabel}
              {selected.length > 0 && (
                <Badge isRead style={{ marginInlineStart: 'var(--pf-t--global--spacer--sm)' }}>
                  {selected.length}
                </Badge>
              )}
            </>
          </MenuToggle>
        )}
        selected={selected}
      >
        {options.map(opt => (
          <SelectOption
            hasCheckbox
            isSelected={selected.includes(opt.value)}
            data-test={`${id}-option-${opt.value}`}
            id={`${id}-option-${opt.value}`}
            key={opt.value}
            value={opt.value}
          >
            {opt.label}
          </SelectOption>
        ))}
      </Select>
    </div>
  );
};

export default HealthMultiSelectFilter;
