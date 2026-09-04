import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { HealthTypeaheadFilter } from '../health-typeahead-filter';

describe('<HealthTypeaheadFilter />', () => {
  const options = [
    { value: 'openshift-monitoring', label: 'openshift-monitoring' },
    { value: 'openshift-dns', label: 'openshift-dns' },
    { value: 'my-app', label: 'my-app' }
  ];

  const props = {
    id: 'health-namespace-filter',
    toggleLabel: 'Namespace',
    options,
    selected: [] as string[],
    onChange: jest.fn()
  };

  beforeEach(() => {
    props.onChange.mockClear();
  });

  const input = () => screen.getByRole('combobox') as HTMLInputElement;

  const focus = async () => {
    await act(async () => {
      fireEvent.focus(input());
    });
  };

  const type = async (value: string) => {
    await act(async () => {
      fireEvent.change(input(), { target: { value } });
    });
  };

  const pressEnter = async () => {
    await act(async () => {
      fireEvent.keyDown(input(), { key: 'Enter' });
    });
  };

  it('renders the input with the label as placeholder', () => {
    render(<HealthTypeaheadFilter {...props} />);
    expect(screen.getByPlaceholderText('Namespace')).toBeInTheDocument();
  });

  it('shows the matching-rules hint and no options until the user types', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();

    await waitFor(() => {
      expect(document.querySelector('[data-test="health-namespace-filter-hint"]')).toBeTruthy();
    });
    expect(screen.getByText('Type a name or pattern, then press Enter')).toBeInTheDocument();
    expect(screen.getByText('Starts with, e.g. openshift-*')).toBeInTheDocument();
    expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeFalsy();
    expect(document.querySelector('#health-namespace-filter-option-openshift-dns')).toBeFalsy();
  });

  it('adds the typed value as a filter when pressing Enter', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my-app');
    await pressEnter();

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(['my-app']);
  });

  it('adds a pattern verbatim as a filter value (no checkbox step)', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('openshift-*');
    await pressEnter();

    expect(props.onChange).toHaveBeenCalledWith(['openshift-*']);
  });

  it('adds an exact value when a suggestion is clicked', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my');

    await waitFor(() => {
      expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(document.querySelector('#health-namespace-filter-option-my-app')!);
    });

    expect(props.onChange).toHaveBeenCalledWith(['my-app']);
  });

  it('appends to the existing selection rather than replacing it', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['openshift-dns']} />);
    await focus();
    await type('my-app');
    await pressEnter();

    expect(props.onChange).toHaveBeenCalledWith(['openshift-dns', 'my-app']);
  });

  it('does not add a duplicate value', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app']} />);
    await focus();
    await type('my-app');
    await pressEnter();

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('suggests matches by a case-insensitive substring for a lower-case query', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('dns');

    await waitFor(() => {
      expect(document.querySelector('#health-namespace-filter-option-openshift-dns')).toBeTruthy();
    });
    expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeFalsy();
    expect(document.querySelector('#health-namespace-filter-option-openshift-monitoring')).toBeFalsy();
  });

  it('suggests matches for a leading wildcard (starts-with)', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('openshift-*');

    await waitFor(() => {
      expect(document.querySelector('#health-namespace-filter-option-openshift-dns')).toBeTruthy();
    });
    expect(document.querySelector('#health-namespace-filter-option-openshift-monitoring')).toBeTruthy();
    expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeFalsy();
  });

  it('treats a quoted value as an exact (anchored) match in suggestions', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();

    await type('"my-app"');
    await waitFor(() => {
      expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeTruthy();
    });

    await type('"my"');
    await waitFor(() => {
      expect(document.querySelector('[data-test="health-namespace-filter-enter-hint"]')).toBeTruthy();
    });
    expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeFalsy();
  });

  it('excludes already-selected values from suggestions', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['openshift-dns']} />);
    await focus();
    await type('openshift-*');

    await waitFor(() => {
      expect(document.querySelector('#health-namespace-filter-option-openshift-monitoring')).toBeTruthy();
    });
    expect(document.querySelector('#health-namespace-filter-option-openshift-dns')).toBeFalsy();
  });

  it('flags a value that is not a valid Kubernetes name and does not add it', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('bad name!');

    await waitFor(() => {
      expect(document.querySelector('[data-test="health-namespace-filter-invalid"]')).toBeTruthy();
    });
    expect(document.querySelector('#health-namespace-filter-option-my-app')).toBeFalsy();

    await pressEnter();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
