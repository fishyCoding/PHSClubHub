import { beforeEach, describe, expect, it } from 'vitest';
import * as A from './actions';
import { addDays, describeMeeting, mondayOf, todayISO } from './dates';
import { createSeed } from './seed';
import { scheduleForClubs } from './selectors';
import { getDB, replaceDB } from './store';
import { slotsOn } from './types';

beforeEach(() => {
  replaceDB({ ...structuredClone(createSeed()), sessionUserId: 'u-maya' }); // leads Robotics
});

describe('Tiger Time and Flex Time', () => {
  it('only exist on their days', () => {
    expect(slotsOn('Thursday')).toContain('tiger time');
    expect(slotsOn('Thursday')).not.toContain('flex time');
    expect(slotsOn('Tuesday')).toContain('flex time');
    expect(slotsOn('Wednesday')).toContain('flex time');
    expect(slotsOn('Monday')).not.toContain('tiger time');
    expect(slotsOn('Friday')).not.toContain('flex time');
  });

  it('reads naturally', () => {
    expect(describeMeeting({ day: 'Thursday', slot: 'tiger time', room: 'x' })).toBe('Thursday Tiger Time');
  });

  it('leaders can save valid meetings and are stopped on the wrong day', () => {
    const save = (day: 'Thursday' | 'Monday', slot: 'tiger time' | 'flex time') =>
      A.updateClubBasics('c-robotics', { description: 'x', meetings: [{ day, slot, room: 'Room 112' }] });
    expect(() => save('Thursday', 'tiger time')).not.toThrow();
    expect(() => save('Monday', 'tiger time')).toThrow(/only on Thursdays/);
    expect(() => save('Thursday', 'flex time')).toThrow(/Tuesday and Wednesday/);
  });

  it('one-time changes are checked against the date', () => {
    const thursday = addDays(mondayOf(todayISO()), 10);
    const base = { kind: 'event' as const, room: 'Lab', title: '', announce: false };
    expect(() => A.createEvent('c-robotics', { ...base, date: thursday, slot: 'flex time' })).toThrow();
    expect(() => A.createEvent('c-robotics', { ...base, date: thursday, slot: 'tiger time' })).not.toThrow();
  });

  it('shows up in the schedule in the right order', () => {
    const tue = addDays(mondayOf(todayISO()), 8);
    const items = scheduleForClubs(getDB(), ['c-mun'], tue, 1);
    expect(items.map((i) => i.slot)).toEqual(['flex time']);
  });
});
