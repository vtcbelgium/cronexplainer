// tests/tool.test.ts
import { describe, it, expect } from 'vitest';
import { parseCronExpression, getModeFromSelector } from '../src/tool.ts';

describe('parseCronExpression', () => {
  it('parses standard 5-field linux cron correctly', () => {
    const result = parseCronExpression('0 12 * * 1-5', 'linux');
    expect(result.valid).toBe(true);
    expect(result.mode).toBe('linux');
    expect(result.fields).toHaveLength(5);
    expect(result.fields[0].name).toBe('Minute');
    expect(result.fields[0].values).toEqual([0]);
    expect(result.fields[1].name).toBe('Hour');
    expect(result.fields[1].values).toEqual([12]);
    expect(result.fields[4].name).toBe('Day of week');
    expect(result.fields[4].values).toEqual([1, 2, 3, 4, 5]);
    expect(result.explanation).toContain('Minute: value 0');
    expect(result.explanation).toContain('Hour: value 12');
    expect(result.explanation).toContain('Day of week: values: 1, 2, 3, 4, 5');
    expect(result.nextRuns.length).toBeGreaterThan(0);
    expect(result.nextRuns.length).toBeLessThanOrEqual(10);
  });

  it('handles AWS EventBridge 6-field format (but we only support 5-field)', () => {
    // AWS EventBridge uses 6 fields but our tool only supports 5-field standard
    // This tests that we correctly reject wrong field count
    const result = parseCronExpression('0 12 * * ? *', 'aws');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Expected 5 fields');
  });

  it('parses GitHub Actions cron correctly', () => {
    const result = parseCronExpression('*/15 * * * *', 'github');
    expect(result.valid).toBe(true);
    expect(result.mode).toBe('github');
    expect(result.fields[0].values).toEqual([0, 15, 30, 45]);
    expect(result.explanation).toContain('every 15 value(s)');
  });

  it('rejects invalid expressions with clear errors', () => {
    const result = parseCronExpression('60 * * * *', 'linux');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Minute'))).toBe(true);
  });

  it('handles step values and ranges correctly', () => {
    const result = parseCronExpression('0 9-17/2 * * 1-5', 'linux');
    expect(result.valid).toBe(true);
    expect(result.fields[1].values).toEqual([9, 11, 13, 15, 17]);
    expect(result.explanation).toContain('every 2 value(s) from 9 to 17');
  });

  it('getModeFromSelector returns correct modes', () => {
    expect(getModeFromSelector('linux')).toBe('linux');
    expect(getModeFromSelector('aws')).toBe('aws');
    expect(getModeFromSelector('github')).toBe('github');
    expect(getModeFromSelector('unknown')).toBe('linux');
  });
});
