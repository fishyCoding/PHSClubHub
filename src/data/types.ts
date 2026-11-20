// Core data model for Club Hub.
// In this prototype everything lives in the browser (see store.ts). The shapes
// below are written so they can map 1:1 onto database tables later.

export type ID = string;

/** Account-level role. "Club leader" is NOT an account role: it is a
 *  per-club role on a Membership, granted only after an admin verifies it. */
export type AccountRole = 'student' | 'admin';

export interface User {
  id: ID;
  name: string;
  email: string;
  role: AccountRole;
  grade?: 9 | 10 | 11 | 12;
  /** Admin-side title, e.g. "Tech Office". */
  title?: string;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SLOTS = ['before school', 'lunch', 'after school', 'evening'] as const;
export type Slot = (typeof SLOTS)[number];

/** A regular meeting, described the way students say it: "Tuesday lunch". */
export interface MeetingTime {
  day: Weekday;
  slot: Slot;
  room: string;
  /** Optional qualifier, e.g. "every other week". */
  note?: string;
}

export const CATEGORIES = [
  'Academic',
  'STEM',
  'Arts',
  'Service',
  'Culture & Identity',
  'Wellness',
  'Games & Hobbies',
  'Media',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Club {
  id: ID;
  name: string;
  description: string;
  category: Category;
  advisor: string;
  meetings: MeetingTime[];
  /** Q-5: if true, only leaders, the advisor and admins can see who is a member. */
  hiddenMembership: boolean;
  /** Archived clubs are hidden from Explore and cannot get new members. */
  archived: boolean;
  createdAt: string; // ISO
  createdBy: ID;
}

export type MembershipStatus = 'pending' | 'active';
export type ClubRole = 'member' | 'leader';

export interface Membership {
  id: ID;
  userId: ID;
  clubId: ID;
  status: MembershipStatus;
  role: ClubRole;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: ID;
}

export interface Follow {
  userId: ID;
  clubId: ID;
  createdAt: string;
}

/** Who a post is delivered to. */
export type Audience =
  | { type: 'public' } // followers + members (+ anyone browsing the club page)
  | { type: 'members' } // active members only: a "private message" to the club
  | { type: 'selected'; userIds: ID[] }; // specific members only

export type PostKind = 'update' | 'schedule';

export interface Post {
  id: ID;
  clubId: ID;
  authorId: ID;
  kind: PostKind;
  title: string;
  body: string;
  audience: Audience;
  pinned: boolean;
  createdAt: string;
  removed?: { by: ID; at: string; reason: string };
}

export type EventKind = 'event' | 'cancelled' | 'moved';

/** A one-off change to the schedule: an extra meeting, a cancellation, or a room move. */
export interface ClubEvent {
  id: ID;
  clubId: ID;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  slot: Slot;
  room: string;
  title: string;
  createdBy: ID;
  createdAt: string;
}

/** Q-4: attendance is visible to the club's leaders and admins only. */
export interface AttendanceSession {
  id: ID;
  clubId: ID;
  date: string; // YYYY-MM-DD
  presentUserIds: ID[];
  /** Members who were active at the time the session was taken (denominator). */
  rosterUserIds: ID[];
  guestCount: number;
  takenBy: ID;
  takenAt: string;
}

export type RequestStatus = 'pending' | 'approved' | 'denied';

/** A student claiming to lead a club. An admin must verify it. */
export interface LeaderRequest {
  id: ID;
  userId: ID;
  clubId: ID;
  position: string; // "President", "Co-founder" ...
  note: string;
  status: RequestStatus;
  createdAt: string;
  decidedBy?: ID;
  decidedAt?: string;
}

export type ReportStatus = 'open' | 'removed' | 'dismissed';

export interface Report {
  id: ID;
  postId: ID;
  reporterId: ID;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  resolvedBy?: ID;
  resolvedAt?: string;
}

export interface AuditEntry {
  id: ID;
  at: string;
  actorId: ID;
  action: string;
  detail: string;
}

export interface DB {
  version: number;
  users: User[];
  clubs: Club[];
  memberships: Membership[];
  follows: Follow[];
  posts: Post[];
  events: ClubEvent[];
  attendance: AttendanceSession[];
  leaderRequests: LeaderRequest[];
  reports: Report[];
  audit: AuditEntry[];
  /** userId -> ids of posts that user has seen. */
  reads: Record<ID, ID[]>;
  sessionUserId: ID | null;
}
