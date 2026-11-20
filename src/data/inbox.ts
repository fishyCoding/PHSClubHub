// The inbox: one list of everything that changed for a user. Items are derived
// from existing data (no separate notifications table), so they can never get
// out of sync. Read state reuses db.reads, keyed by each item's id.

import { addDays, formatDate, slotLabel, todayISO } from './dates';
import * as P from './permissions';
import { clubById, feedFor, userById } from './selectors';
import type { AttendanceSession, DB, ID } from './types';

/** How long attendance notifications stay in the inbox. */
export const ATTENDANCE_WINDOW_DAYS = 14;

/** Changes whenever the roll is re-saved, so an edit shows up as a new notification. */
export function attendanceItemId(s: Pick<AttendanceSession, 'id' | 'takenAt'>) {
  return `att:${s.id}:${s.takenAt}`;
}

export type InboxKind =
  | 'post' // update from a club you follow or belong to
  | 'private' // members-only or direct message
  | 'schedule' // cancellation / room change / extra meeting
  | 'membership' // your join request was approved, or you were made a leader
  | 'leader-request' // your leader request was decided
  | 'moderation' // your post was removed
  | 'attendance' // a leader marked you present or absent
  | 'join-request' // (leaders) someone wants to join your club
  | 'admin-leader' // (admins) a student asked to be verified as a leader
  | 'admin-report'; // (admins) a post was reported

export type InboxGroup = 'updates' | 'activity' | 'action';

export interface InboxItem {
  /** Stable id; also the key stored in db.reads. */
  id: string;
  kind: InboxKind;
  group: InboxGroup;
  at: string; // ISO date-time
  clubId?: ID;
  title: string;
  body?: string;
  /** Where clicking the item goes. */
  to: string;
  /** Related record id (e.g. the membership behind a join request). */
  ref?: ID;
  /** Attendance notifications: were you there? */
  present?: boolean;
  /** Still needs someone to do something (stays visible until handled). */
  needsAction?: boolean;
}

/** How far back non-actionable activity is shown. */
const WINDOW_DAYS = 30;

export function inboxFor(db: DB, userId: ID): InboxItem[] {
  const me = P.getUser(db, userId);
  if (!me) return [];
  const since = addDays(todayISO(), -WINDOW_DAYS);
  const items: InboxItem[] = [];
  const club = (id: ID) => clubById(db, id)?.name ?? 'A club';
  const name = (id: ID) => userById(db, id)?.name ?? 'Someone';

  // Club posts (same rules as the home feed).
  for (const p of feedFor(db, userId)) {
    if (p.authorId === userId) continue;
    const kind: InboxKind =
      p.kind === 'schedule' ? 'schedule' : p.audience.type === 'public' ? 'post' : 'private';
    items.push({
      id: p.id,
      kind,
      group: 'updates',
      at: p.createdAt,
      clubId: p.clubId,
      title: p.title,
      body: p.body,
      to: `/clubs/${p.clubId}`,
    });
  }

  // My memberships approved / leader role granted by someone else.
  for (const m of db.memberships) {
    if (m.userId !== userId || m.status !== 'active' || !m.approvedAt) continue;
    if (m.approvedBy === userId || m.approvedAt < since) continue;
    items.push({
      id: `m:${m.id}:${m.role}`,
      kind: 'membership',
      group: 'activity',
      at: m.approvedAt,
      clubId: m.clubId,
      title:
        m.role === 'leader'
          ? `You're now a verified leader of ${club(m.clubId)}`
          : `You're in! ${club(m.clubId)} approved your request`,
      body: m.role === 'leader' ? 'You can post updates, edit the schedule and take attendance.' : undefined,
      to: m.role === 'leader' ? `/lead/${m.clubId}` : `/clubs/${m.clubId}`,
    });
  }

  // My leader requests decided.
  for (const r of db.leaderRequests) {
    if (r.userId !== userId || r.status === 'pending' || !r.decidedAt || r.decidedAt < since) continue;
    items.push({
      id: `lr:${r.id}`,
      kind: 'leader-request',
      group: 'activity',
      at: r.decidedAt,
      clubId: r.clubId,
      title:
        r.status === 'approved'
          ? `Leader request approved: ${r.position}, ${club(r.clubId)}`
          : `Leader request not approved: ${club(r.clubId)}`,
      body: r.status === 'denied' ? 'Talk to the Activities Office if you think this is a mistake.' : undefined,
      to: '/my-clubs',
    });
  }

  // My posts removed by a moderator.
  for (const p of db.posts) {
    if (p.authorId !== userId || !p.removed || p.removed.at < since) continue;
    items.push({
      id: `rm:${p.id}`,
      kind: 'moderation',
      group: 'activity',
      at: p.removed.at,
      clubId: p.clubId,
      title: `Your post "${p.title}" was removed`,
      body: p.removed.reason,
      to: `/lead/${p.clubId}`,
    });
  }

  // Attendance: you were marked present or absent.
  const attSince = addDays(todayISO(), -ATTENDANCE_WINDOW_DAYS);
  for (const s of db.attendance) {
    if (!s.rosterUserIds.includes(userId) || s.takenBy === userId || s.date < attSince) continue;
    const here = s.presentUserIds.includes(userId);
    const when = `${formatDate(s.date)}${s.slot ? ` ${slotLabel(s.slot)}` : ''}`;
    items.push({
      id: attendanceItemId(s),
      kind: 'attendance',
      group: 'activity',
      at: s.takenAt,
      clubId: s.clubId,
      title: here ? `You were marked present · ${when}` : `You were marked absent · ${when}`,
      body: here ? undefined : "If you were there, let a club leader know so they can fix it.",
      to: `/clubs/${s.clubId}`,
      present: here,
    });
  }

  // Leaders: pending join requests.
  for (const c of P.clubsLedBy(db, userId)) {
    for (const m of db.memberships) {
      if (m.clubId !== c.id || m.status !== 'pending') continue;
      items.push({
        id: `jr:${m.id}`,
        kind: 'join-request',
        group: 'action',
        at: m.requestedAt,
        clubId: c.id,
        title: `${name(m.userId)} wants to join ${c.name}`,
        to: `/lead/${c.id}?tab=members`,
        ref: m.id,
        needsAction: true,
      });
    }
  }

  // Admins: leader verifications and reports.
  if (me.role === 'admin') {
    for (const r of db.leaderRequests) {
      if (r.status !== 'pending') continue;
      items.push({
        id: `alr:${r.id}`,
        kind: 'admin-leader',
        group: 'action',
        at: r.createdAt,
        clubId: r.clubId,
        title: `${name(r.userId)} asked to be verified as ${r.position} of ${club(r.clubId)}`,
        body: r.note || undefined,
        to: '/admin/leaders',
        needsAction: true,
      });
    }
    for (const r of db.reports) {
      if (r.status !== 'open') continue;
      const post = db.posts.find((p) => p.id === r.postId);
      items.push({
        id: `rep:${r.id}`,
        kind: 'admin-report',
        group: 'action',
        at: r.createdAt,
        clubId: post?.clubId,
        title: `Post reported${post ? `: "${post.title}"` : ''}`,
        body: r.reason,
        to: '/admin/moderation',
        needsAction: true,
      });
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export function inboxUnread(db: DB, userId: ID): InboxItem[] {
  const read = new Set(db.reads[userId] ?? []);
  return inboxFor(db, userId).filter((i) => !read.has(i.id));
}

export function inboxUnreadCount(db: DB, userId: ID): number {
  return inboxUnread(db, userId).length;
}
