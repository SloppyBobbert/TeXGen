import { describe, expect, it } from 'vitest';
import { parseSections, planSectionRemoval, validSectionMetadata } from './documentSections';

const block = (kind, id, body) => `% @texgen-section v1 begin ${kind}:${id}\n${body}% @texgen-section v1 end ${kind}:${id}\n`;
const a = 'algebra-i.slope-formula';
const b = 'algebra-i.slope-intercept-form';
const baseline = `HEADER\n${block('c', a, `CLASS\n${block('g', a, `CATEGORY\n${block('f', a, 'first\n')}${block('f', b, 'second\n')}END CATEGORY\n`)}END CLASS\n`)}FOOTER`;
const metadata = { version: 1, baseline };
const known = new Set([a, b]);

describe('bounded document sections', () => {
  it('keeps custom bytes and removes only an untouched target', () => {
    const source = baseline.replace('HEADER\n', 'HEADER\nmy notes\n').replace('second\n', 'edited sibling\n');
    const result = planSectionRemoval(source, metadata, [a], known);
    expect(result.safe).toBe(true);
    expect(result.edited).toBe(false);
    expect(result.source).toBe(source.replace(block('f', a, 'first\n'), ''));
    expect(result.metadata.baseline).not.toContain('first\n');
  });

  it('requires confirmation for edited removed content and includes empty group wrappers', () => {
    const source = baseline.replace('first\n', 'my work\n');
    const result = planSectionRemoval(source, metadata, [a, b], known);
    expect(result).toMatchObject({ safe: true, edited: true, source: 'HEADER\nFOOTER', metadata: null });
    expect(source).toContain('my work');
  });

  it('compares with the saved baseline, not a later catalog version', () => {
    expect(planSectionRemoval(baseline, metadata, [a], known).edited).toBe(false);
  });

  it.each([
    baseline.replace(`end f:${a}`, `end f:${b}`),
    baseline.replace(`begin f:${a}`, `begin f:unknown.formula`),
    baseline.replace(block('f', a, 'first\n'), ''),
    baseline.replace('first\n', `first\n${block('f', a, 'duplicate\n')}`),
    baseline.replace('CATEGORY\n', 'changed wrapper\n'),
    baseline.replace('CATEGORY\n', 'CATEGORY\n\\begin{minipage}\n'),
    baseline.replace('CATEGORY\n', 'CATEGORY\n{cross-boundary\n'),
    baseline + '\n% @texgen-section broken\n',
  ])('keeps source when a boundary or wrapper is unsafe', (source) => {
    expect(planSectionRemoval(source, metadata, [a], known).safe).toBe(false);
  });

  it('rejects legacy metadata, oversized input, unknown IDs, and empty trees', () => {
    expect(validSectionMetadata({ version: 2, baseline })).toBe(false);
    expect(validSectionMetadata({ version: 1, baseline, extra: 1 })).toBe(false);
    expect(parseSections('x'.repeat(262145))).toBeNull();
    expect(parseSections(block('c', a, ''))).toBeNull();
    expect(planSectionRemoval(baseline, metadata, [a], new Set()).safe).toBe(false);
    expect(planSectionRemoval(baseline, null, [a], known).safe).toBe(false);
  });
});
