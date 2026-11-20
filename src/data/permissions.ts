// Every visibility / permission rule in Club Hub lives in this file.
// The UI uses these to decide what to show, and actions.ts uses them to refuse
// writes. When a real backend exists, these same rules must be enforced there.

import type { Club, DB, ID, Membership, Post, User } from './types';

export function getUser(db: DB, userId: ID | null | undefined): User | undefined {
  return userId ? db.users.find((u) => u.id === userId) : undefined;
}

export function isAdmin(db: DB, userId: ID | null | undefined): boolean {
  return getUser(db, userId)?.role === 'admin';
}

export function membershipOf(db: DB, userId: ID, clubId: ID): Membership | undefined {
  return db.memberships.find((m) => m.userId === userId && m.clubId === clubId);
}

/** Active member OR leader. */
export function isActiveMember(db: DB, userId: ID, clubId: ID): boolean {
  return membershipOf(db, userId, clubId)?.status === 'active';
}

/** A verified leader of this club (leader role is only granted by an admin). */
export function isLeader(db: DB, userId: ID, clubId: ID): boolean {
  const m = membershipOf(db, userId, clubId);
  return m?.status === 'active' && m.role === 'leader';
}

export function isFollowing(db: DB, userId: ID, clubId: ID): boolean {
  return db.follows.some((f) => f.userId === userId && f.clubId === clubId);
}

/** Leaders of the club, or any admin. */
export function canManageClub(db: DB, userId: ID, clubId: ID): boolean {
  return isAdmin(db, userId) || isLeader(db, userId, clubId);
}

/**
 * Q-3 / Q-5: who can see a club's member list.
 *  - Admins and the club's leaders: always.
 *  - Active members: yes, unless the club has hidden membership.
 *  - Followers / everyone else: never.
 */
export function canSeeMembers(db: DB, userId: ID, club: Club): boolean {
  if (canManageClub(db, userId, club.id)) return true;
  if (club.hiddenMembership) return false;
  return isActiveMember(db, userId, club.id);
}

/** Q-4: attendance is for evaluating clubs. Only leaders of the club and admins. */
export function canSeeAttendance(db: DB, userId: ID, clubId: ID): boolean {
  return canManageClub(db, userId, clubId);
}

export function canTakeAttendance(db: DB, userId: ID, clubId: ID): boolean {
  return isLeader(db, userId, clubId) || isAdmin(db, userId);
}

/** Can this user read this post? */
export function canSeePost(db: DB, userId: ID, post: Post): boolean {
  if (post.removed) return isAdmin(db, userId);
  if (canManageClub(db, userId, post.clubId)) return true;
  switch (post.audience.type) {
    case 'public':
      return true;
    case 'members':
      return isActiveMember(db, userId, post.clubId);
    case 'selected':
      return isActiveMember(db, userId, post.clubId) && post.audience.userIds.includes(userId);
  }
}

/** Does this post show up in the user's home feed (vs. only on the club page)? */
export function isInFeed(db: DB, userId: ID, post: Post): boolean {
  if (post.removed) return false;
  if (!canSeePost(db, userId, post)) return false;
  return (
    isActiveMember(db, userId, post.clubId) || isFollowing(db, userId, post.clubId)
  );
}

/** Students who are members or followers can say whether they're coming. */
export function canRsvp(db: DB, userId: ID, clubId: ID): boolean {
  if (getUser(db, userId)?.role !== 'student') return false;
  return isActiveMember(db, userId, clubId) || isFollowing(db, userId, clubId);
}

/** Q-2: only admins create clubs. */
export function canCreateClub(db: DB, userId: ID): boolean {
  return isAdmin(db, userId);
}

export function canPost(db: DB, userId: ID, clubId: ID): boolean {
  return isLeader(db, userId, clubId) || isAdmin(db, userId);
}

export function canReport(db: DB, userId: ID, post: Post): boolean {
  return !!getUser(db, userId) && post.authorId !== userId && canSeePost(db, userId, post);
}

export function leadsAnyClub(db: DB, userId: ID): boolean {
  return db.memberships.some(
    (m) => m.userId === userId && m.role === 'leader' && m.status === 'active',
  );
}

export function clubsLedBy(db: DB, userId: ID): Club[] {
  const ids = new Set(
    db.memberships
      .filter((m) => m.userId === userId && m.role === 'leader' && m.status === 'active')
      .map((m) => m.clubId),
  );
  return db.clubs.filter((c) => ids.has(c.id) && !c.archived);
}
