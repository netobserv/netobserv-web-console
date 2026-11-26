import { dependencyMatches } from '../utils';

describe('dependencyMatches', () => {
  it('matches nested controls in the resource spec', () => {
    expect(
      dependencyMatches(
        { spec: { agent: { type: 'eBPF' } } },
        { controlFieldPath: ['agent', 'type'], controlFieldValue: 'eBPF', controlFieldName: 'type' }
      )
    ).toBe(true);
  });

  it('supports multiple allowed values', () => {
    expect(
      dependencyMatches(
        { spec: { outputType: 'packets' } },
        { controlFieldPath: ['outputType'], controlFieldValue: ['flows', 'packets'], controlFieldName: 'outputType' }
      )
    ).toBe(true);
  });

  it('does not match a different nested value', () => {
    expect(
      dependencyMatches(
        { spec: { agent: { type: 'IPFIX' } } },
        { controlFieldPath: ['agent', 'type'], controlFieldValue: 'eBPF', controlFieldName: 'type' }
      )
    ).toBe(false);
  });
});
