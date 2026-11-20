import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayISO } from './dates';
import { createSeed } from './seed';
import { change, clubStats } from './stats';
import { getDB, replaceDB } from './store';

beforeEach(() => {
  replaceDB(structuredClone(createSeed()));
});

describe('attendance stats', () => {
  it('summarizes meetings in the window and compares with the one before', () => {
    const s = clubStats(getDB(), 'c-robotics', 30);
    expect(s.current.meetings).toBeGreaterThan(0);
    expect(s.previous?.meetings).toBeGreaterThan(0);
    expect(s.points.every((p) => p.date >= addDays(todayISO(), -30))).toBe(true);
    expect(s.points.map((p) => p.date)).toEqual([...s.points.map((p) => p.date)].sort()); // oldest first
    expect(s.current.avgRate).toBeGreaterThan(0);
    expect(s.current.avgRate).toBeLessThanOrEqual(1);
  });

  it('demo story: Robotics is growing, Coding Club is fading', () => {
    const rob = clubStats(getDB(), 'c-robotics', 30);
    const code = clubStats(getDB(), 'c-code', 30);
    expect(change(rob.current.avgRate, rob.previous?.avgRate)!).toBeGreaterThan(0);
    expect(change(code.current.avgRate, code.previous?.avgRate)!).toBeLessThan(0);
  });

  it('flags members who missed several meetings in a row', () => {
    const omar = clubStats(getDB(), 'c-robotics', 90).members.find((m) => m.user.id === 'u-omar')!;
    expect(omar.missedInARow).toBeGreaterThanOrEqual(3);
  });

  it('measures RSVP follow-through from past meetings', () => {
    const ft = clubStats(getDB(), 'c-robotics', 30).followThrough;
    expect(ft.said).toBeGreaterThan(0);
    expect(ft.came).toBeLessThanOrEqual(ft.said);
  });

  it('all time has no comparison period', () => {
    expect(clubStats(getDB(), 'c-robotics', 'all').previous).toBeNull();
  });
});
