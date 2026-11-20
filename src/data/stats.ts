// Attendance statistics for one club over a time window. Pure functions.
// Q-4: only the club's leaders and admins may see these (checked by the page).

import { addDays, todayISO, weekdayOf } from './dates';
import { activeMembers, attendanceFor, userById } from './selectors';
import type { AttendanceSession, DB, ID, User, Weekday } from './types';
import { WEEKDAYS } from './types';

export type StatsRange = 30 | 90 | 'all';

export interface MeetingPoint {
  date: string;
  members: number; // members present
  guests: number;
  roster: number; // active members at the time
  rate: number; // members / roster
}

export interface MemberRecord {
  user: User;
  present: number;
  total: number;
  rate: number;
  lastPresent?: string;
  /** How many of the most recent meetings in a row they missed. */
  missedInARow: number;
}

export interface Period {
  meetings: number;
  avgPeople: number; // members + guests per meeting
  avgRate: number; // 0..1
}

export interface ClubStats {
  range: StatsRange;
  current: Period;
  /** The same-length window just before this one (null for "all time"). */
  previous: Period | null;
  points: MeetingPoint[]; // oldest -> newest
  byWeekday: { day: Weekday; avgPeople: number; meetings: number }[];
  members: MemberRecord[];
  /** Of the people who said "going", how many came. */
  followThrough: { said: number; came: number };
  best?: MeetingPoint;
}

function summarize(sessions: AttendanceSession[]): Period {
  const n = sessions.length;
  if (n === 0) return { meetings: 0, avgPeople: 0, avgRate: 0 };
  let people = 0;
  let rate = 0;
  for (const s of sessions) {
    people += s.presentUserIds.length + s.guestCount;
    rate += s.rosterUserIds.length ? s.presentUserIds.length / s.rosterUserIds.length : 0;
  }
  return { meetings: n, avgPeople: people / n, avgRate: rate / n };
}

export function clubStats(db: DB, clubId: ID, range: StatsRange): ClubStats {
  const today = todayISO();
  const all = attendanceFor(db, clubId) // newest first
    .filter((s) => s.date < today || s.date === today);
  const from = range === 'all' ? '' : addDays(today, -range);
  const inRange = all.filter((s) => s.date >= from);
  const prevFrom = range === 'all' ? null : addDays(today, -2 * range);
  const prev = prevFrom === null ? null : all.filter((s) => s.date >= prevFrom && s.date < from);

  const points: MeetingPoint[] = [...inRange].reverse().map((s) => ({
    date: s.date,
    members: s.presentUserIds.length,
    guests: s.guestCount,
    roster: s.rosterUserIds.length,
    rate: s.rosterUserIds.length ? s.presentUserIds.length / s.rosterUserIds.length : 0,
  }));

  const byWeekday = WEEKDAYS.map((day) => {
    const ss = inRange.filter((s) => weekdayOf(s.date) === day);
    return { day, avgPeople: summarize(ss).avgPeople, meetings: ss.length };
  }).filter((d) => d.meetings > 0);

  // Per member, over the meetings in range where they were on the roster.
  const members: MemberRecord[] = activeMembers(db, clubId)
    .map((m) => userById(db, m.userId))
    .filter((u): u is User => !!u)
    .map((user) => {
      const theirs = inRange.filter((s) => s.rosterUserIds.includes(user.id)); // newest first
      const present = theirs.filter((s) => s.presentUserIds.includes(user.id));
      let missedInARow = 0;
      for (const s of theirs) {
        if (s.presentUserIds.includes(user.id)) break;
        missedInARow++;
      }
      return {
        user,
        present: present.length,
        total: theirs.length,
        rate: theirs.length ? present.length / theirs.length : 0,
        lastPresent: present[0]?.date,
        missedInARow,
      };
    })
    .sort((a, b) => b.rate - a.rate || a.user.name.localeCompare(b.user.name));

  // RSVP follow-through: "going" answers for meetings that have a recorded roll.
  let said = 0;
  let came = 0;
  for (const r of db.rsvps) {
    if (r.clubId !== clubId || r.status !== 'going' || r.date < from || r.date >= today) continue;
    const s = inRange.find((x) => x.date === r.date);
    if (!s) continue;
    said++;
    if (s.presentUserIds.includes(r.userId)) came++;
  }

  const best = points.reduce<MeetingPoint | undefined>(
    (b, p) => (!b || p.members + p.guests > b.members + b.guests ? p : b),
    undefined,
  );

  return {
    range,
    current: summarize(inRange),
    previous: prev ? summarize(prev) : null,
    points,
    byWeekday,
    members,
    followThrough: { said, came },
    best,
  };
}

/** Relative change, or null when there's nothing to compare against. */
export function change(now: number, before: number | undefined): number | null {
  if (before === undefined || before === 0) return null;
  return (now - before) / before;
}
