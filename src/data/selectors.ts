// Read-only helpers that derive views from the DB. Pure functions, easy to test.

import { addDays, mondayOf, slotOrder, todayISO, weekdayOf } from './dates';
import * as P from './permissions';
import type { AttendanceSession, Club, ClubEvent, DB, ID, Post, Slot, User } from './types';

export function clubById(db: DB, id: ID | undefined): Club | undefined {
  return db.clubs.find((c) => c.id === id);
}

export function userById(db: DB, id: ID | undefined): User | undefined {
  return db.users.find((u) => u.id === id);
}

export function activeMembers(db: DB, clubId: ID) {
  return db.memberships.filter((m) => m.clubId === clubId && m.status === 'active');
}

export function pendingMembers(db: DB, clubId: ID) {
  return db.memberships.filter((m) => m.clubId === clubId && m.status === 'pending');
}

export function followerCount(db: DB, clubId: ID): number {
  return db.follows.filter((f) => f.clubId === clubId).length;
}

/** Posts in the user's home feed, newest first. */
export function feedFor(db: DB, userId: ID): Post[] {
  return db.posts
    .filter((p) => P.isInFeed(db, userId, p))
    .filter((p) => !clubById(db, p.clubId)?.archived)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Posts visible on a club page for this user: pinned first, then newest. */
export function clubPostsFor(db: DB, userId: ID, clubId: ID): Post[] {
  return db.posts
    .filter((p) => p.clubId === clubId && P.canSeePost(db, userId, p))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

export function isRead(db: DB, userId: ID, postId: ID): boolean {
  return (db.reads[userId] ?? []).includes(postId);
}

/** Clubs the user follows or belongs to (active or pending). */
export function myClubIds(db: DB, userId: ID): { joined: ID[]; pending: ID[]; following: ID[] } {
  const joined: ID[] = [];
  const pending: ID[] = [];
  for (const m of db.memberships) {
    if (m.userId !== userId) continue;
    (m.status === 'active' ? joined : pending).push(m.clubId);
  }
  const following = db.follows
    .filter((f) => f.userId === userId && !joined.includes(f.clubId))
    .map((f) => f.clubId);
  return { joined, pending, following };
}

// ---------------------------------------------------------------- schedule

export interface ScheduleItem {
  date: string;
  clubId: ID;
  slot: Slot;
  room: string;
  title?: string;
  note?: string;
  status: 'regular' | 'cancelled' | 'moved' | 'extra';
  relation: 'member' | 'following';
}

/** Concrete meetings for each school day in [start, start+days). */
export function scheduleFor(db: DB, userId: ID, start: string, days: number): ScheduleItem[] {
  const { joined, following } = myClubIds(db, userId);
  const rel = new Map<ID, 'member' | 'following'>();
  following.forEach((id) => rel.set(id, 'following'));
  joined.forEach((id) => rel.set(id, 'member'));
  return scheduleForClubs(db, [...rel.keys()], start, days).map((it) => ({
    ...it,
    relation: rel.get(it.clubId)!,
  }));
}

export function scheduleForClubs(
  db: DB,
  clubIds: ID[],
  start: string,
  days: number,
): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  const clubs = db.clubs.filter((c) => clubIds.includes(c.id) && !c.archived);
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const wd = weekdayOf(date);
    for (const club of clubs) {
      const evs = db.events.filter((e) => e.clubId === club.id && e.date === date);
      if (wd) {
        for (const m of club.meetings) {
          if (m.day !== wd) continue;
          const override = evs.find(
            (e) => (e.kind === 'cancelled' || e.kind === 'moved') && e.slot === m.slot,
          );
          out.push({
            date,
            clubId: club.id,
            slot: m.slot,
            room: override?.kind === 'moved' ? override.room : m.room,
            note: m.note,
            title: override?.title,
            status: override ? (override.kind as 'cancelled' | 'moved') : 'regular',
            relation: 'member',
          });
        }
      }
      for (const e of evs.filter((x) => x.kind === 'event')) {
        out.push({
          date,
          clubId: club.id,
          slot: e.slot,
          room: e.room,
          title: e.title,
          status: 'extra',
          relation: 'member',
        });
      }
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot),
  );
}

export function upcomingEvents(db: DB, clubId: ID, from = todayISO()): ClubEvent[] {
  return db.events
    .filter((e) => e.clubId === clubId && e.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function thisWeekStart(): string {
  return mondayOf(todayISO());
}

// ---------------------------------------------------------------- attendance

export interface ClubAttendanceStats {
  clubId: ID;
  sessions: number;
  sessionsLast30: number;
  avgPresent: number;
  avgRate: number; // 0..1
  lastSession?: string;
  activeMembers: number;
  trend: number[]; // rate per session, oldest -> newest (last 8)
}

export function attendanceFor(db: DB, clubId: ID): AttendanceSession[] {
  return db.attendance
    .filter((a) => a.clubId === clubId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function attendanceStats(db: DB, clubId: ID): ClubAttendanceStats {
  const sessions = attendanceFor(db, clubId);
  const cutoff = addDays(todayISO(), -30);
  const rates = sessions.map((s) =>
    s.rosterUserIds.length ? s.presentUserIds.length / s.rosterUserIds.length : 0,
  );
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    clubId,
    sessions: sessions.length,
    sessionsLast30: sessions.filter((s) => s.date >= cutoff).length,
    avgPresent: avg(sessions.map((s) => s.presentUserIds.length + s.guestCount)),
    avgRate: avg(rates),
    lastSession: sessions[0]?.date,
    activeMembers: activeMembers(db, clubId).length,
    trend: rates.slice(0, 8).reverse(),
  };
}

/** Per-member attendance rate within a club. */
export function memberAttendance(db: DB, clubId: ID, userId: ID): { present: number; total: number } {
  const sessions = attendanceFor(db, clubId).filter((s) => s.rosterUserIds.includes(userId));
  return {
    present: sessions.filter((s) => s.presentUserIds.includes(userId)).length,
    total: sessions.length,
  };
}
