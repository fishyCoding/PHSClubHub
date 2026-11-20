// Every write in the app goes through these functions. Each one checks
// permissions (permissions.ts) for the signed-in user before changing data,
// the same way a server endpoint would.

import { getDB, mutate, newId } from './store';
import * as P from './permissions';
import type {
  Audience,
  Club,
  ClubEvent,
  DB,
  EventKind,
  ID,
  MeetingTime,
  PostKind,
  Slot,
} from './types';

export class PermissionError extends Error {}

function now() {
  return new Date().toISOString();
}

function actor(): ID {
  const id = getDB().sessionUserId;
  if (!id || !P.getUser(getDB(), id)) throw new PermissionError('Please sign in first.');
  return id;
}

function ensure(cond: boolean, msg = 'You do not have permission to do that.') {
  if (!cond) throw new PermissionError(msg);
}

function audit(d: DB, actorId: ID, action: string, detail: string) {
  d.audit.unshift({ id: newId('log'), at: now(), actorId, action, detail });
  if (d.audit.length > 500) d.audit.length = 500;
}

function clubName(d: DB, clubId: ID) {
  return d.clubs.find((c) => c.id === clubId)?.name ?? clubId;
}

function userName(d: DB, userId: ID) {
  return d.users.find((u) => u.id === userId)?.name ?? userId;
}

function getClub(d: DB, clubId: ID): Club {
  const c = d.clubs.find((x) => x.id === clubId);
  if (!c) throw new PermissionError('That club does not exist.');
  return c;
}

// ---------------------------------------------------------------- session

export function signIn(userId: ID) {
  mutate((d) => {
    ensure(!!P.getUser(d, userId), 'Unknown account.');
    d.sessionUserId = userId;
  });
}

export function signOut() {
  mutate((d) => {
    d.sessionUserId = null;
  });
}

// ---------------------------------------------------------------- student

export function follow(clubId: ID) {
  const me = actor();
  mutate((d) => {
    ensure(!getClub(d, clubId).archived, 'This club is archived.');
    if (!P.isFollowing(d, me, clubId)) d.follows.push({ userId: me, clubId, createdAt: now() });
  });
}

export function unfollow(clubId: ID) {
  const me = actor();
  mutate((d) => {
    d.follows = d.follows.filter((f) => !(f.userId === me && f.clubId === clubId));
  });
}

export function requestJoin(clubId: ID) {
  const me = actor();
  mutate((d) => {
    ensure(!getClub(d, clubId).archived, 'This club is archived.');
    ensure(!P.membershipOf(d, me, clubId), 'You already asked to join this club.');
    d.memberships.push({
      id: newId('m'),
      userId: me,
      clubId,
      role: 'member',
      status: 'pending',
      requestedAt: now(),
    });
  });
}

/** Cancel a pending request or leave the club. */
export function leaveClub(clubId: ID) {
  const me = actor();
  mutate((d) => {
    const m = P.membershipOf(d, me, clubId);
    if (!m) return;
    if (m.role === 'leader') {
      const leaders = d.memberships.filter(
        (x) => x.clubId === clubId && x.role === 'leader' && x.status === 'active',
      );
      ensure(
        leaders.length > 1,
        'You are the only leader. Ask an administrator to transfer leadership before leaving.',
      );
    }
    d.memberships = d.memberships.filter((x) => x.id !== m.id);
  });
}

export function markRead(postIds: ID[]) {
  const me = getDB().sessionUserId;
  if (!me || postIds.length === 0) return;
  const seen = new Set(getDB().reads[me] ?? []);
  const fresh = postIds.filter((id) => !seen.has(id));
  if (fresh.length === 0) return;
  mutate((d) => {
    d.reads[me] = [...(d.reads[me] ?? []), ...fresh];
  });
}

export function reportPost(postId: ID, reason: string) {
  const me = actor();
  mutate((d) => {
    const post = d.posts.find((p) => p.id === postId);
    ensure(!!post && P.canReport(d, me, post), 'You cannot report this post.');
    ensure(reason.trim().length > 0, 'Please say what is wrong with the post.');
    ensure(
      !d.reports.some((r) => r.postId === postId && r.reporterId === me && r.status === 'open'),
      'You already reported this post. An administrator will review it.',
    );
    d.reports.push({
      id: newId('r'),
      postId,
      reporterId: me,
      reason: reason.trim(),
      status: 'open',
      createdAt: now(),
    });
  });
}

export function requestLeaderRole(clubId: ID, position: string, note: string) {
  const me = actor();
  mutate((d) => {
    getClub(d, clubId);
    ensure(!P.isLeader(d, me, clubId), 'You are already a verified leader of this club.');
    ensure(
      !d.leaderRequests.some((r) => r.userId === me && r.clubId === clubId && r.status === 'pending'),
      'You already have a pending request for this club.',
    );
    ensure(position.trim().length > 0, 'Please enter your position.');
    d.leaderRequests.push({
      id: newId('lr'),
      userId: me,
      clubId,
      position: position.trim(),
      note: note.trim(),
      status: 'pending',
      createdAt: now(),
    });
  });
}

// ---------------------------------------------------------------- leader

export function approveMember(membershipId: ID) {
  const me = actor();
  mutate((d) => {
    const m = d.memberships.find((x) => x.id === membershipId);
    ensure(!!m && P.canManageClub(d, me, m.clubId));
    m!.status = 'active';
    m!.approvedAt = now();
    m!.approvedBy = me;
    audit(d, me, 'Approved member', `${userName(d, m!.userId)} → ${clubName(d, m!.clubId)}`);
  });
}

export function declineMember(membershipId: ID) {
  const me = actor();
  mutate((d) => {
    const m = d.memberships.find((x) => x.id === membershipId);
    ensure(!!m && P.canManageClub(d, me, m.clubId));
    ensure(m!.role !== 'leader', 'Leaders can only be removed by an administrator.');
    d.memberships = d.memberships.filter((x) => x.id !== membershipId);
    audit(
      d,
      me,
      m!.status === 'pending' ? 'Declined join request' : 'Removed member',
      `${userName(d, m!.userId)} ← ${clubName(d, m!.clubId)}`,
    );
  });
}

export interface PostInput {
  title: string;
  body: string;
  audience: Audience;
  kind?: PostKind;
  pinned?: boolean;
}

export function createPost(clubId: ID, input: PostInput): ID {
  const me = actor();
  const id = newId('p');
  mutate((d) => {
    ensure(P.canPost(d, me, clubId), 'Only verified leaders of this club can post.');
    ensure(input.title.trim().length > 0, 'Add a title.');
    if (input.audience.type === 'selected') {
      ensure(input.audience.userIds.length > 0, 'Pick at least one member to message.');
      ensure(
        input.audience.userIds.every((u) => P.isActiveMember(d, u, clubId)),
        'You can only message members of this club.',
      );
    }
    d.posts.push({
      id,
      clubId,
      authorId: me,
      kind: input.kind ?? 'update',
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience,
      pinned: !!input.pinned,
      createdAt: now(),
    });
    d.reads[me] = [...(d.reads[me] ?? []), id];
  });
  return id;
}

export function deletePost(postId: ID) {
  const me = actor();
  mutate((d) => {
    const p = d.posts.find((x) => x.id === postId);
    ensure(!!p && P.canManageClub(d, me, p.clubId));
    d.posts = d.posts.filter((x) => x.id !== postId);
    d.reports = d.reports.filter((r) => r.postId !== postId);
  });
}

export function togglePin(postId: ID) {
  const me = actor();
  mutate((d) => {
    const p = d.posts.find((x) => x.id === postId);
    ensure(!!p && P.canManageClub(d, me, p.clubId));
    p!.pinned = !p!.pinned;
  });
}

export interface EventInput {
  kind: EventKind;
  date: string;
  slot: Slot;
  room: string;
  title: string;
  /** Also send an update to followers + members. */
  announce: boolean;
}

export function createEvent(clubId: ID, input: EventInput) {
  const me = actor();
  mutate((d) => {
    ensure(P.canPost(d, me, clubId));
    ensure(/^\d{4}-\d{2}-\d{2}$/.test(input.date), 'Pick a date.');
    const club = getClub(d, clubId);
    const ev: ClubEvent = {
      id: newId('e'),
      clubId,
      kind: input.kind,
      date: input.date,
      slot: input.slot,
      room: input.room.trim() || club.meetings[0]?.room || 'TBD',
      title:
        input.title.trim() ||
        (input.kind === 'cancelled' ? 'Meeting cancelled' : input.kind === 'moved' ? 'Room change' : 'Extra meeting'),
      createdBy: me,
      createdAt: now(),
    };
    d.events.push(ev);
    if (input.announce) {
      const when = new Date(input.date + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      const verb =
        ev.kind === 'cancelled'
          ? `Cancelled: ${when} ${ev.slot}`
          : ev.kind === 'moved'
            ? `Moved: ${when} ${ev.slot} is in ${ev.room}`
            : `Added: ${when} ${ev.slot} in ${ev.room}`;
      d.posts.push({
        id: newId('p'),
        clubId,
        authorId: me,
        kind: 'schedule',
        title: verb,
        body: ev.title,
        audience: { type: 'public' },
        pinned: false,
        createdAt: now(),
      });
    }
  });
}

export function deleteEvent(eventId: ID) {
  const me = actor();
  mutate((d) => {
    const ev = d.events.find((e) => e.id === eventId);
    ensure(!!ev && P.canManageClub(d, me, ev.clubId));
    d.events = d.events.filter((e) => e.id !== eventId);
  });
}

/** Leaders may edit the description and meeting times; admins can also use updateClubAdmin. */
export function updateClubBasics(
  clubId: ID,
  input: { description: string; meetings: MeetingTime[] },
) {
  const me = actor();
  mutate((d) => {
    ensure(P.canManageClub(d, me, clubId));
    ensure(input.meetings.every((m) => m.room.trim()), 'Every meeting needs a room.');
    const c = getClub(d, clubId);
    c.description = input.description.trim();
    c.meetings = input.meetings.map((m) => ({ ...m, room: m.room.trim(), note: m.note?.trim() || undefined }));
    audit(d, me, 'Edited club info', c.name);
  });
}

export function saveAttendance(
  clubId: ID,
  date: string,
  presentUserIds: ID[],
  guestCount: number,
) {
  const me = actor();
  mutate((d) => {
    ensure(P.canTakeAttendance(d, me, clubId), 'Only leaders can take attendance.');
    ensure(/^\d{4}-\d{2}-\d{2}$/.test(date), 'Pick a date.');
    const roster = d.memberships
      .filter((m) => m.clubId === clubId && m.status === 'active')
      .map((m) => m.userId);
    const present = presentUserIds.filter((u) => roster.includes(u));
    const existing = d.attendance.find((a) => a.clubId === clubId && a.date === date);
    if (existing) {
      existing.presentUserIds = present;
      existing.rosterUserIds = roster;
      existing.guestCount = Math.max(0, Math.floor(guestCount));
      existing.takenBy = me;
      existing.takenAt = now();
    } else {
      d.attendance.push({
        id: newId('a'),
        clubId,
        date,
        presentUserIds: present,
        rosterUserIds: roster,
        guestCount: Math.max(0, Math.floor(guestCount)),
        takenBy: me,
        takenAt: now(),
      });
    }
  });
}

export function deleteAttendance(sessionId: ID) {
  const me = actor();
  mutate((d) => {
    const s = d.attendance.find((a) => a.id === sessionId);
    ensure(!!s && P.canTakeAttendance(d, me, s.clubId));
    d.attendance = d.attendance.filter((a) => a.id !== sessionId);
  });
}

// ---------------------------------------------------------------- admin

function requireAdmin(d: DB, me: ID) {
  ensure(P.isAdmin(d, me), 'Administrators only.');
}

export type ClubInput = Pick<
  Club,
  'name' | 'description' | 'category' | 'advisor' | 'meetings' | 'hiddenMembership'
>;

export function createClub(input: ClubInput): ID {
  const me = actor();
  const id = newId('c');
  mutate((d) => {
    ensure(P.canCreateClub(d, me), 'Only administrators can create clubs.');
    ensure(input.name.trim().length > 0, 'Club name is required.');
    ensure(
      !d.clubs.some((c) => c.name.toLowerCase() === input.name.trim().toLowerCase()),
      'A club with that name already exists.',
    );
    d.clubs.push({
      id,
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
      advisor: input.advisor.trim(),
      archived: false,
      createdAt: now(),
      createdBy: me,
    });
    audit(d, me, 'Created club', input.name.trim());
  });
  return id;
}

export function updateClubAdmin(clubId: ID, input: Partial<ClubInput> & { archived?: boolean }) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    const c = getClub(d, clubId);
    if (input.name !== undefined) {
      ensure(input.name.trim().length > 0, 'Club name is required.');
      c.name = input.name.trim();
    }
    if (input.description !== undefined) c.description = input.description.trim();
    if (input.category !== undefined) c.category = input.category;
    if (input.advisor !== undefined) c.advisor = input.advisor.trim();
    if (input.meetings !== undefined) c.meetings = input.meetings;
    if (input.hiddenMembership !== undefined) c.hiddenMembership = input.hiddenMembership;
    if (input.archived !== undefined) c.archived = input.archived;
    audit(d, me, 'Edited club', c.name);
  });
}

export function decideLeaderRequest(requestId: ID, approve: boolean) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    const r = d.leaderRequests.find((x) => x.id === requestId);
    ensure(!!r && r.status === 'pending', 'That request was already handled.');
    r!.status = approve ? 'approved' : 'denied';
    r!.decidedBy = me;
    r!.decidedAt = now();
    if (approve) grantLeader(d, r!.userId, r!.clubId, me);
    audit(
      d,
      me,
      approve ? 'Verified leader' : 'Denied leader request',
      `${userName(d, r!.userId)} (${r!.position}) – ${clubName(d, r!.clubId)}`,
    );
  });
}

function grantLeader(d: DB, userId: ID, clubId: ID, by: ID) {
  const m = P.membershipOf(d, userId, clubId);
  if (m) {
    m.role = 'leader';
    m.status = 'active';
    m.approvedAt = now();
    m.approvedBy = by;
  } else {
    d.memberships.push({
      id: newId('m'),
      userId,
      clubId,
      role: 'leader',
      status: 'active',
      requestedAt: now(),
      approvedAt: now(),
      approvedBy: by,
    });
  }
}

export function assignLeader(userId: ID, clubId: ID) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    getClub(d, clubId);
    ensure(P.getUser(d, userId)?.role === 'student', 'Only student accounts can be club leaders.');
    grantLeader(d, userId, clubId, me);
    d.leaderRequests
      .filter((r) => r.userId === userId && r.clubId === clubId && r.status === 'pending')
      .forEach((r) => {
        r.status = 'approved';
        r.decidedBy = me;
        r.decidedAt = now();
      });
    audit(d, me, 'Assigned leader', `${userName(d, userId)} – ${clubName(d, clubId)}`);
  });
}

/** Demote a leader to a regular member. */
export function revokeLeader(membershipId: ID) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    const m = d.memberships.find((x) => x.id === membershipId);
    ensure(!!m && m.role === 'leader', 'Not a leader.');
    m!.role = 'member';
    audit(d, me, 'Revoked leader', `${userName(d, m!.userId)} – ${clubName(d, m!.clubId)}`);
  });
}

export function removePost(postId: ID, reason: string) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    const p = d.posts.find((x) => x.id === postId);
    ensure(!!p, 'Post not found.');
    p!.removed = { by: me, at: now(), reason: reason.trim() || 'Removed by moderator' };
    d.reports
      .filter((r) => r.postId === postId && r.status === 'open')
      .forEach((r) => {
        r.status = 'removed';
        r.resolvedBy = me;
        r.resolvedAt = now();
      });
    audit(d, me, 'Removed post', `"${p!.title}" – ${clubName(d, p!.clubId)}`);
  });
}

export function restorePost(postId: ID) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    const p = d.posts.find((x) => x.id === postId);
    ensure(!!p, 'Post not found.');
    delete p!.removed;
    audit(d, me, 'Restored post', `"${p!.title}" – ${clubName(d, p!.clubId)}`);
  });
}

export function dismissReport(reportId: ID) {
  const me = actor();
  mutate((d) => {
    requireAdmin(d, me);
    const r = d.reports.find((x) => x.id === reportId);
    ensure(!!r && r.status === 'open', 'Report already handled.');
    r!.status = 'dismissed';
    r!.resolvedBy = me;
    r!.resolvedAt = now();
    audit(d, me, 'Dismissed report', r!.reason.slice(0, 80));
  });
}
