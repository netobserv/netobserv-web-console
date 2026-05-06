import { Popover, ProgressStep, ProgressStepper } from '@patternfly/react-core';
import * as React from 'react';
import { FlowScope } from '../../model/flow-query';
import { ScopeConfigDef } from '../../model/scope';
import './scope-slider.css';

export interface ScopeSliderProps {
  scope: FlowScope;
  setScope: (ms: FlowScope) => void;
  scopeDefs: ScopeConfigDef[];
}

export const ScopeSlider: React.FC<ScopeSliderProps> = ({ scope, setScope, scopeDefs }) => {
  return (
    <ProgressStepper isVertical isCenterAligned>
      {scopeDefs.map((sd, i) => (
        <ProgressStep
          key={`scope-step-${i}`}
          id={`scope-step-${i}`}
          titleId={`scope-step-${i}`}
          variant={sd.id === scope ? 'info' : 'pending'}
          isCurrent={sd.id === scope}
          onClick={() => setScope(sd.id)}
          popoverRender={stepRef => (
            <Popover
              headerContent={<div>{sd.name}</div>}
              bodyContent={<div>{sd.description}</div>}
              triggerRef={stepRef}
              position="right"
            />
          )}
        >
          {sd.name}
        </ProgressStep>
      ))}
    </ProgressStepper>
  );
};
