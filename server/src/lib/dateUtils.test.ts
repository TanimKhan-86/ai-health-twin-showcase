import test from 'node:test';
import assert from 'node:assert/strict';
import { getUtcDayRange, getUtcDayKey, shiftUtcDays, toUtcDayStart } from './dateUtils';

test('toUtcDayStart normalizes to UTC midnight', () => {
    const start = toUtcDayStart('2026-03-01T18:45:10.000Z');
    assert.equal(start.toISOString(), '2026-03-01T00:00:00.000Z');
});

test('shiftUtcDays shifts date by day units', () => {
    const base = new Date('2026-03-01T00:00:00.000Z');
    const shifted = shiftUtcDays(base, 3);
    assert.equal(shifted.toISOString(), '2026-03-04T00:00:00.000Z');
});

test('getUtcDayRange returns inclusive day start and next day end', () => {
    const { start, end } = getUtcDayRange('2026-03-01T10:00:00.000Z');
    assert.equal(start.toISOString(), '2026-03-01T00:00:00.000Z');
    assert.equal(end.toISOString(), '2026-03-02T00:00:00.000Z');
    assert.equal(getUtcDayKey(start), '2026-03-01');
});
