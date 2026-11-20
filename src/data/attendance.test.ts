import { beforeEach, describe, expect, it } from 'vitest';
import * as A from './actions';
import { addDays, todayISO } from './dates';
import { inboxFor, inboxUnread } from './inbox';
import { createSeed } from './seed';
import { getDB, replaceDB } from './store';

function as(userId: string) {
  replaceDB({ ...getDB(), sessionUserId: userId });
}

beforeEach(() => {
  replaceDB(structuredClone(createSeed()));
});

describe('taking attendance', () => {
  it('records which meeting it was for, and editing updates the same record', () => {
    as('u-maya');
    const day = addDays(todayISO(), -1);
    A.saveAttendance('c-robotics', day, ['u-priya'], 0, 'after school');
    A.saveAttendance('c-robotics', day, ['u-priya', 'u-grace'], 1, 'after school');
    const recs = getDB().attendance.filter((a) => a.clubId === 'c-robotics' && a.date === day);
    expect(recs).toHaveLength(1);
    expect(recs[0].slot).toBe('after school');
    expect(recs[0].presentUserIds).toEqual(['u-priya', 'u-grace']);
  });

  it("can't be taken for a future meeting", () => {
    as('u-maya');
    expect(() => A.saveAttendance('c-robotics', addDays(todayISO(), 3), [], 0, 'after school')).toThrow(/hasn't happened/);
  });
});

describe('attendance notifications', () => {
  it('members hear whether they were marked present or absent', () => {
    as('u-maya');
    A.saveAttendance('c-robotics', addDays(todayISO(), -1), ['u-priya'], 0, 'after school');
    const priya = inboxUnread(getDB(), 'u-priya').filter((i) => i.kind === 'attendance');
    const grace = inboxUnread(getDB(), 'u-grace').filter((i) => i.kind === 'attendance');
    expect(priya.some((i) => i.present && i.title.includes('present'))).toBe(true);
    expect(grace.some((i) => i.present === false && i.title.includes('absent'))).toBe(true);
    // The leader who took it doesn't notify themselves.
    expect(inboxFor(getDB(), 'u-maya').some((i) => i.kind === 'attendance' && i.clubId === 'c-robotics' && i.at > addDays(todayISO(), -1))).toBe(false);
  });

  it('editing the roll sends a fresh notification', () => {
    as('u-maya');
    const day = addDays(todayISO(), -1);
    A.saveAttendance('c-robotics', day, [], 0, 'after school');
    const first = inboxUnread(getDB(), 'u-priya').find((i) => i.kind === 'attendance' && !i.present)!;
    A.markRead([first.id]);
    A.saveAttendance('c-robotics', day, ['u-priya'], 0, 'after school');
    const again = inboxUnread(getDB(), 'u-priya').find((i) => i.kind === 'attendance');
    expect(again?.present).toBe(true);
  });

  it('old demo records start out read', () => {
    const old = inboxUnread(getDB(), 'u-priya').filter((i) => i.kind === 'attendance' && i.at < addDays(todayISO(), -3));
    expect(old).toHaveLength(0);
  });
});
