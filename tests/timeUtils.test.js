/**
 * Unit tests for timeUtils
 */

const { floorToSlotUTC, jstToUTC, generateSlotKey } = require('../utils/timeUtils');

describe('floorToSlotUTC', () => {
  test('floors :00 minutes to same slot', () => {
    const input = new Date('2025-09-04T21:00:00+09:00');
    const result = floorToSlotUTC(input, 30);
    expect(result.toISOString()).toBe('2025-09-04T12:00:00.000Z'); // 21:00 JST = 12:00 UTC
  });

  test('floors :30 minutes to same slot', () => {
    const input = new Date('2025-09-04T21:30:00+09:00');
    const result = floorToSlotUTC(input, 30);
    expect(result.toISOString()).toBe('2025-09-04T12:30:00.000Z'); // 21:30 JST = 12:30 UTC
  });

  test('floors :29 minutes to :00 slot', () => {
    const input = new Date('2025-09-04T21:29:59+09:00');
    const result = floorToSlotUTC(input, 30);
    expect(result.toISOString()).toBe('2025-09-04T12:00:00.000Z'); // floors to 21:00 JST = 12:00 UTC
  });

  test('floors :59 minutes to :30 slot', () => {
    const input = new Date('2025-09-04T21:59:59+09:00');
    const result = floorToSlotUTC(input, 30);
    expect(result.toISOString()).toBe('2025-09-04T12:30:00.000Z'); // floors to 21:30 JST = 12:30 UTC
  });

  test('handles UTC input correctly', () => {
    const input = new Date('2025-09-04T12:15:00.000Z');
    const result = floorToSlotUTC(input, 30);
    expect(result.toISOString()).toBe('2025-09-04T12:00:00.000Z');
  });

  test('handles 15-minute slots', () => {
    const input = new Date('2025-09-04T21:17:00+09:00');
    const result = floorToSlotUTC(input, 15);
    expect(result.toISOString()).toBe('2025-09-04T12:15:00.000Z'); // floors to 21:15 JST = 12:15 UTC
  });

  test('handles 60-minute slots', () => {
    const input = new Date('2025-09-04T21:45:00+09:00');
    const result = floorToSlotUTC(input, 60);
    expect(result.toISOString()).toBe('2025-09-04T12:00:00.000Z'); // floors to 21:00 JST = 12:00 UTC
  });

  test('throws on invalid date', () => {
    expect(() => floorToSlotUTC('invalid-date', 30)).toThrow('Invalid date');
  });
});

describe('jstToUTC', () => {
  test('converts JST to UTC correctly', () => {
    const jst = '2025-09-04T21:30:00+09:00';
    const result = jstToUTC(jst);
    expect(result.toISOString()).toBe('2025-09-04T12:30:00.000Z');
  });

  test('handles already UTC input', () => {
    const utc = '2025-09-04T12:30:00.000Z';
    const result = jstToUTC(utc);
    expect(result.toISOString()).toBe('2025-09-04T12:30:00.000Z');
  });

  test('throws on invalid input', () => {
    expect(() => jstToUTC('not-a-date')).toThrow('Invalid JST datetime');
  });
});

describe('generateSlotKey', () => {
  test('generates key with seat ID', () => {
    const slotUTC = new Date('2025-09-04T12:30:00.000Z');
    const key = generateSlotKey('store1', slotUTC, 'seat-A');
    expect(key).toBe('store1:2025-09-04T12:30:00.000Z:seat-A');
  });

  test('generates key with default seat', () => {
    const slotUTC = new Date('2025-09-04T12:30:00.000Z');
    const key = generateSlotKey('store1', slotUTC);
    expect(key).toBe('store1:2025-09-04T12:30:00.000Z:_default_');
  });
});