import { FilterDefinitionSample } from '../../components/__tests-data__/filters';
import { findFilter } from '../../utils/filter-definitions';
import { doesIncludeFilter, Filter, FilterCompare, filtersEqual, summarizeFilters } from '../filters';
import { filtersToString } from '../flow-query';

describe('doesIncludeFilter', () => {
  const srcNameFilter = findFilter(FilterDefinitionSample, 'src_name')!;
  const notDstNameFilter = findFilter(FilterDefinitionSample, 'dst_name')!;
  const activeFilters: Filter[] = [
    {
      def: srcNameFilter,
      compare: FilterCompare.equal,
      values: [{ v: 'abc' }, { v: 'def' }]
    },
    {
      def: notDstNameFilter,
      compare: FilterCompare.notEqual,
      values: [{ v: 'abc' }, { v: 'def' }]
    }
  ];

  it('should encode as', () => {
    const asString = filtersToString(activeFilters, false);
    expect(asString).toEqual(encodeURIComponent('SrcK8S_Name=abc,def&DstK8S_Name!=abc,def'));
  });

  it('should not include filter due to different key', () => {
    const isIncluded = doesIncludeFilter(
      activeFilters,
      { def: findFilter(FilterDefinitionSample, 'protocol')!, compare: FilterCompare.equal },
      [{ v: 'abc' }, { v: 'def' }]
    );
    expect(isIncluded).toBeFalsy();
  });

  it('should not include filter due to missing value', () => {
    const isIncluded = doesIncludeFilter(activeFilters, { def: srcNameFilter, compare: FilterCompare.equal }, [
      { v: 'abc' },
      { v: 'def' },
      { v: 'ghi' }
    ]);
    expect(isIncluded).toBeFalsy();
  });

  it('should include filter with exact values', () => {
    const isIncluded = doesIncludeFilter(activeFilters, { def: srcNameFilter, compare: FilterCompare.equal }, [
      { v: 'abc' },
      { v: 'def' }
    ]);
    expect(isIncluded).toBeTruthy();
  });

  it('should include filter with values included', () => {
    const isIncluded = doesIncludeFilter(activeFilters, { def: srcNameFilter, compare: FilterCompare.equal }, [
      { v: 'abc' }
    ]);
    expect(isIncluded).toBeTruthy();
  });

  it('should not include filter due to different key (not)', () => {
    const isIncluded = doesIncludeFilter(activeFilters, { def: notDstNameFilter, compare: FilterCompare.equal }, [
      { v: 'abc' },
      { v: 'def' }
    ]);
    expect(isIncluded).toBeFalsy();
  });

  it('should include filter with same key (not)', () => {
    const isIncluded = doesIncludeFilter(activeFilters, { def: notDstNameFilter, compare: FilterCompare.notEqual }, [
      { v: 'abc' },
      { v: 'def' }
    ]);
    expect(isIncluded).toBeTruthy();
  });
});

describe('filtersEqual', () => {
  const f1 = findFilter(FilterDefinitionSample, 'src_name')!;
  const f2 = findFilter(FilterDefinitionSample, 'dst_name')!;
  const values1 = [{ v: 'abc' }, { v: 'def' }];
  const values2 = [{ v: 'def' }, { v: 'abc' }];
  const values3 = [{ v: 'abc' }, { v: 'def', display: 'def' }];
  const values4 = [{ v: 'abc' }];

  it('should be equal with same order', () => {
    const list1: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    const list2: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    expect(filtersEqual(list1, list2)).toBe(true);
    expect(filtersEqual(list2, list1)).toBe(true);
  });

  it('should be equal with different order', () => {
    const list1: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    const list2: Filter[] = [
      { def: f2, compare: FilterCompare.notEqual, values: values1 },
      { def: f1, compare: FilterCompare.equal, values: values1 }
    ];
    expect(filtersEqual(list1, list2)).toBe(true);
    expect(filtersEqual(list2, list1)).toBe(true);
  });

  it('should be equal with different values order', () => {
    const list1: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    const list2: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values2 },
      { def: f2, compare: FilterCompare.notEqual, values: values2 }
    ];
    expect(filtersEqual(list1, list2)).toBe(true);
    expect(filtersEqual(list2, list1)).toBe(true);
  });

  it('should be equal with different values display', () => {
    const list1: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    const list2: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values3 },
      { def: f2, compare: FilterCompare.notEqual, values: values3 }
    ];
    expect(filtersEqual(list1, list2)).toBe(true);
    expect(filtersEqual(list2, list1)).toBe(true);
  });

  it('should differ with different keys', () => {
    const list1: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    const list2: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f1, compare: FilterCompare.notEqual, values: values1 }
    ];
    expect(filtersEqual(list1, list2)).toBe(false);
    expect(filtersEqual(list2, list1)).toBe(false);
  });

  it('should differ with different values', () => {
    const list1: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values1 }
    ];
    const list2: Filter[] = [
      { def: f1, compare: FilterCompare.equal, values: values1 },
      { def: f2, compare: FilterCompare.notEqual, values: values4 }
    ];
    expect(filtersEqual(list1, list2)).toBe(false);
    expect(filtersEqual(list2, list1)).toBe(false);
  });
});

describe('Filters summary', () => {
  const srcNamespace = findFilter(FilterDefinitionSample, 'src_namespace')!;
  const dstName = findFilter(FilterDefinitionSample, 'dst_name')!;
  const dstPort = findFilter(FilterDefinitionSample, 'dst_port')!;
  const anyNamespace = findFilter(FilterDefinitionSample, 'namespace')!;
  const protocol = findFilter(FilterDefinitionSample, 'protocol')!;

  it('should summarize with source and destination, ignoring disabled protocol', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        },
        {
          def: dstName,
          compare: FilterCompare.equal,
          values: [{ v: 'their-pod' }]
        },
        {
          def: dstPort,
          compare: FilterCompare.equal,
          values: [{ v: '443' }]
        },
        {
          def: protocol,
          compare: FilterCompare.equal,
          values: [{ v: 'TCP', disabled: true }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('from my-namespace to their-pod,443');
  });

  it('should summarize with source alone', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('from my-namespace');
  });

  it('should summarize with destination alone', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: dstName,
          compare: FilterCompare.equal,
          values: [{ v: 'their-pod' }]
        },
        {
          def: dstPort,
          compare: FilterCompare.equal,
          values: [{ v: '443' }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('to their-pod,443');
  });

  it('should summarize with source OR destination', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        },
        {
          def: dstName,
          compare: FilterCompare.equal,
          values: [{ v: 'their-pod' }]
        },
        {
          def: dstPort,
          compare: FilterCompare.equal,
          values: [{ v: '443' }]
        }
      ],
      match: 'any'
    });
    expect(summary).toEqual('from my-namespace or to their-pod,443');
  });

  it('should summarize with source and destination, two ways', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        },
        {
          def: dstName,
          compare: FilterCompare.equal,
          values: [{ v: 'their-pod' }]
        },
        {
          def: dstPort,
          compare: FilterCompare.equal,
          values: [{ v: '443' }]
        }
      ],
      match: 'bidirectional'
    });
    expect(summary).toEqual('between my-namespace and their-pod,443');
  });

  it('should summarize with source alone, two ways', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        }
      ],
      match: 'bidirectional'
    });
    expect(summary).toEqual('from/to my-namespace');
  });

  it('should summarize with any-side namespace', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: anyNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('from/to my-namespace');
  });

  it('should summarize with protocol alone', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: protocol,
          compare: FilterCompare.equal,
          values: [{ v: 'TCP' }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('TCP');
  });

  it('should summarize with source and protocol', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.equal,
          values: [{ v: 'my-namespace' }]
        },
        {
          def: protocol,
          compare: FilterCompare.equal,
          values: [{ v: 'TCP' }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('TCP, from my-namespace');
  });

  it('should summarize with source regexp, destination not regexp and not protocol', () => {
    const summary = summarizeFilters({
      list: [
        {
          def: srcNamespace,
          compare: FilterCompare.match,
          values: [{ v: 'my-namespace' }]
        },
        {
          def: dstName,
          compare: FilterCompare.notMatch,
          values: [{ v: 'their-pod' }]
        },
        {
          def: protocol,
          compare: FilterCompare.notEqual,
          values: [{ v: 'TCP' }]
        }
      ],
      match: 'all'
    });
    expect(summary).toEqual('!=TCP, from ~my-namespace to !~their-pod');
  });
});
