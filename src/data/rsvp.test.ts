import { beforeEach, describe, expect, it } from 'vitest';
import * as A from './actions';
import { addDays, todayISO } from './dates';
import { createSeed } from './seed';
import { rsvpOf, rsvpSummary, scheduleForClubs } from './selectors';
import { getDB, replaceDB } from './store';

function as(userId: string) {
  replaceDB({ ...getDB(), sessionUserId: userId });
}

/** Next real (not cancelled) Robotics meeting. */
function nextRobotics() {
  return scheduleForClubs(getDB(), ['c-robotics'], todayISO(), 14).find((s) => s.status !== 'cancelled')!;
}

beforeEach(() => {
  replaceDB(structuredClone(createSeed()));
});

describe('RSVP', () => {
  it('members can say going, change their mind, and clear it', () => {
    as('u-priya');
    const m = nextRobotics();
    A.setRsvp('c-robotics', m.date, m.slot, 'going');
    expect(rsvpOf(getDB(), 'u-priya', 'c-robotics', m.date, m.slot)).toBe('going');
    expect(rsvpSummary(getDB(), 'c-robotics', m.date, m.slot).going).toContain('u-priya');

    A.setRsvp('c-robotics', m.date, m.slot, 'not_going');
    const s = rsvpSummary(getDB(), 'c-robotics', m.date, m.slot);
    expect(s.going).not.toContain('u-priya');
    expect(s.notGoing).toContain('u-priya');

    A.setRsvp('c-robotics', m.date, m.slot, null);
    expect(rsvpOf(getDB(), 'u-priya', 'c-robotics', m.date, m.slot)).toBeUndefined();
  });

  it('followers can RSVP, strangers and admins cannot', () => {
    const m = nextRobotics();
    as('u-lena'); // follows Robotics
    expect(() => A.setRsvp('c-robotics', m.date, m.slot, 'maybe')).not.toThrow();
    as('u-ruby'); // no relation to Robotics
    expect(() => A.setRsvp('c-robotics', m.date, m.slot, 'going')).toThrow(/Follow or join/);
    as('u-admin');
    expect(() => A.setRsvp('c-robotics', m.date, m.slot, 'going')).toThrow();
  });

  it('only for real, upcoming meetings', () => {
    as('u-priya');
    const m = nextRobotics();
    expect(() => A.setRsvp('c-robotics', addDays(todayISO(), -7), m.slot, 'going')).toThrow(/already happened/);
    expect(() => A.setRsvp('c-robotics', m.date, 'evening', 'going')).toThrow(/not on the schedule/);
  });

  it('seed data gives leaders some headcounts to look at', () => {
    expect(getDB().rsvps.length).toBeGreaterThan(0);
    expect(getDB().rsvps.some((r) => r.userId === 'u-priya')).toBe(false);
  });
});
