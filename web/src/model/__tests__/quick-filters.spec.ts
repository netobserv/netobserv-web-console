import { FilterDefinitionSample } from '../../components/__tests-data__/filters';
import { findFilter } from '../../utils/filter-definitions';
import { FilterCompare } from '../filters';
import { parseQuickFilters } from '../quick-filters';

describe('parseQuickFilters', () => {
  it('should parse nominal case', () => {
    const parsed = parseQuickFilters(FilterDefinitionSample, [
      {
        name: 'Test',
        default: '',
        filter: { src_name: 'foo', src_namespace: 'bar,baz' }
      },
      {
        name: 'Test 2',
        default: '',
        filter: { src_name: 'foo2', src_namespace: 'bar2' }
      }
    ]);
    const srcName = findFilter(FilterDefinitionSample, 'src_name')!;
    const srcNamespace = findFilter(FilterDefinitionSample, 'src_namespace')!;
    expect(parsed).toEqual([
      {
        name: 'Test',
        default: '',
        filters: [
          {
            def: srcName,
            compare: FilterCompare.match,
            values: [{ v: 'foo' }]
          },
          {
            def: srcNamespace,
            compare: FilterCompare.match,
            values: [{ v: 'bar' }, { v: 'baz' }]
          }
        ]
      },
      {
        name: 'Test 2',
        default: '',
        filters: [
          {
            def: srcName,
            compare: FilterCompare.match,
            values: [{ v: 'foo2' }]
          },
          {
            def: srcNamespace,
            compare: FilterCompare.match,
            values: [{ v: 'bar2' }]
          }
        ]
      }
    ]);
  });

  it('should parse empty', () => {
    const parsed = parseQuickFilters(FilterDefinitionSample, []);
    expect(parsed).toEqual([]);
  });

  it('should parse not / sup case', () => {
    const parsed = parseQuickFilters(FilterDefinitionSample, [
      {
        name: 'Test',
        default: '',
        filter: { 'src_name!': 'foo', 'src_namespace>': '3' }
      }
    ]);
    const srcName = findFilter(FilterDefinitionSample, 'src_name')!;
    const srcNamespace = findFilter(FilterDefinitionSample, 'src_namespace')!;
    expect(parsed).toEqual([
      {
        name: 'Test',
        default: '',
        filters: [
          {
            def: srcName,
            compare: FilterCompare.notMatch,
            values: [{ v: 'foo' }]
          },
          {
            def: srcNamespace,
            compare: FilterCompare.moreThanOrEqual,
            values: [{ v: '3' }]
          }
        ]
      }
    ]);
  });

  it('should parse exact cases', () => {
    const parsed = parseQuickFilters(FilterDefinitionSample, [
      {
        name: 'Test',
        default: '',
        filter: { src_name: '"foo","foo2"', 'src_namespace!': '"bar","bar2"' }
      }
    ]);
    const srcName = findFilter(FilterDefinitionSample, 'src_name')!;
    const srcNamespace = findFilter(FilterDefinitionSample, 'src_namespace')!;
    expect(parsed).toEqual([
      {
        name: 'Test',
        default: '',
        filters: [
          {
            def: srcName,
            compare: FilterCompare.equal,
            values: [{ v: 'foo' }, { v: 'foo2' }]
          },
          {
            def: srcNamespace,
            compare: FilterCompare.notEqual,
            values: [{ v: 'bar' }, { v: 'bar2' }]
          }
        ]
      }
    ]);
  });
});
