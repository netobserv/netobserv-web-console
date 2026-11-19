import { render } from '@testing-library/react';
import * as React from 'react';

import { Record } from '../../../../api/ipfix';
import { DefaultColumnSample } from '../../../__tests-data__/columns';
import { FlowsSample } from '../../../__tests-data__/flows';
import { Size } from '../../../dropdowns/table-display-dropdown';
import NetflowTableRow from '../netflow-table-row';

describe('<NetflowTableRow />', () => {
  let flows: Record[] = [];
  const mocks = {
    allowPktDrops: true,
    size: 'm' as Size,
    onSelect: jest.fn(),
    tableWidth: 100
  };

  it('should render component', async () => {
    flows = FlowsSample;
    const { container } = render(
      <table>
        <tbody>
          <NetflowTableRow flow={flows[0]} columns={DefaultColumnSample} {...mocks} highlight={false} />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll('tr')).toHaveLength(1);
    expect(container.querySelectorAll('td')).toHaveLength(DefaultColumnSample.length);
  });

  it('should render given columns', async () => {
    flows = FlowsSample;
    const reducedColumns = DefaultColumnSample.slice(2, 4);
    const { container } = render(
      <table>
        <tbody>
          <NetflowTableRow flow={flows[0]} columns={reducedColumns} {...mocks} highlight={true} />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll('tr')).toHaveLength(1);
    expect(container.querySelectorAll('td')).toHaveLength(reducedColumns.length);
  });
});
