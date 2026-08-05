import { describe, expect, it } from 'vitest';

import { formatResponseStats, formatStatusLabel, getRunnerStatusTag } from '../runner-feedback';

describe('formatStatusLabel()', () => {
  it('combines code and message, falling back to the standard reason then the bare message', () => {
    expect(formatStatusLabel({ statusCode: 200, statusMessage: 'OK' })).toBe('200 OK');
    expect(formatStatusLabel({ statusCode: 404 })).toBe('404 Not Found');
    expect(formatStatusLabel({ statusMessage: 'Canceled' })).toBe('Canceled');
  });
});

describe('formatResponseStats()', () => {
  it('rounds the time and scales the size unit', () => {
    expect(formatResponseStats({ responseTime: 36.6, responseSize: 212 })).toBe('37ms - 212 bytes');
    expect(formatResponseStats({ responseTime: 1, responseSize: 4096 })).toBe('1ms - 4 kilobytes');
  });
});

describe('getRunnerStatusTag()', () => {
  it('colors a completed status code green/yellow/red, and falls back to ERROR with no code', () => {
    expect(getRunnerStatusTag({ status: 'completed', statusCode: 200, statusMessage: 'OK' })).toEqual({
      label: '200 OK',
      className: 'bg-lime-600',
    });
    expect(getRunnerStatusTag({ status: 'completed', statusCode: 302 }).className).toBe('bg-yellow-600');
    expect(getRunnerStatusTag({ status: 'completed', statusCode: 500 }).className).toBe('bg-red-600');
    expect(getRunnerStatusTag({ status: 'failed' })).toEqual({ label: 'ERROR', className: 'bg-red-600' });
  });
});
