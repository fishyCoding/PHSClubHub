import { beforeEach, describe, expect, it } from 'vitest';
import * as A from './actions';
import * as P from './permissions';
import { createSeed } from './seed';
import { feedFor, scheduleForClubs } from './selectors';
import { getDB, replaceDB } from './store';

function as(userId: string) {
  replaceDB({ ...getDB(), sessionUserId: userId });
}

beforeEach(() => {
  replaceDB(structuredClone(createSeed()));
});

const club = (id: string) => getDB().clubs.find((c) => c.id === id)!;

describe('member list visibility (Q-3, Q-5)', () => {
  it('members see each other, followers do not', () => {
    const db = getDB();
    expect(P.canSeeMembers(db, 'u-priya', club('c-robotics'))).toBe(true); // member
    expect(P.canSeeMembers(db, 'u-lena', club('c-robotics'))).toBe(false); // follower
    expect(P.canSeeMembers(db, 'u-sam', club('c-robotics'))).toBe(false); // pending
  });

  it('hidden-membership clubs: only leaders and admins', () => {
    const db = getDB();
    expect(P.canSeeMembers(db, 'u-priya', club('c-gsa'))).toBe(false); // member
    expect(P.canSeeMembers(db, 'u-aisha', club('c-gsa'))).toBe(true); // leader
    expect(P.canSeeMembers(db, 'u-admin', club('c-gsa'))).toBe(true);
  });
});

describe('attendance visibility (Q-4)', () => {
  it('only club leaders and admins', () => {
    const db = getDB();
    expect(P.canSeeAttendance(db, 'u-maya', 'c-robotics')).toBe(true);
    expect(P.canSeeAttendance(db, 'u-admin', 'c-robotics')).toBe(true);
    expect(P.canSeeAttendance(db, 'u-priya', 'c-robotics')).toBe(false);
    expect(P.canSeeAttendance(db, 'u-maya', 'c-debate')).toBe(false); // member, not leader
  });

  it('non-leaders cannot save attendance', () => {
    as('u-priya');
    expect(() => A.saveAttendance('c-robotics', '2026-01-06', [], 0)).toThrow(A.PermissionError);
  });
});

describe('club creation (Q-2)', () => {
  it('admins only', () => {
    as('u-maya');
    expect(() =>
      A.createClub({ name: 'X', description: '', category: 'STEM', advisor: '', meetings: [], hiddenMembership: false }),
    ).toThrow(A.PermissionError);
    as('u-admin');
    const id = A.createClub({ name: 'X', description: '', category: 'STEM', advisor: '', meetings: [], hiddenMembership: false });
    expect(getDB().clubs.some((c) => c.id === id)).toBe(true);
  });
});

describe('posts and private messages', () => {
  it('followers get public updates; members also get members-only', () => {
    const lenaFeed = feedFor(getDB(), 'u-lena').map((p) => p.id); // follows robotics
    expect(lenaFeed).toContain('p-1');
    expect(lenaFeed).not.toContain('p-2');
    const priyaFeed = feedFor(getDB(), 'u-priya').map((p) => p.id); // member of robotics
    expect(priyaFeed).toContain('p-2');
  });

  it('selected-member messages reach only those members', () => {
    const db = getDB();
    const post = db.posts.find((p) => p.id === 'p-3')!;
    expect(P.canSeePost(db, 'u-priya', post)).toBe(true);
    expect(P.canSeePost(db, 'u-grace', post)).toBe(false); // member, not selected
    expect(P.canSeePost(db, 'u-kenji', post)).toBe(true); // leader
  });

  it('only verified leaders can post', () => {
    as('u-priya');
    expect(() => A.createPost('c-robotics', { title: 'hi', body: '', audience: { type: 'public' } })).toThrow();
    as('u-maya');
    A.createPost('c-robotics', { title: 'hi', body: '', audience: { type: 'members' } });
  });

  it('removed posts are hidden from everyone but admins', () => {
    as('u-admin');
    A.removePost('p-1', 'test');
    const db = getDB();
    const post = db.posts.find((p) => p.id === 'p-1')!;
    expect(P.canSeePost(db, 'u-priya', post)).toBe(false);
    expect(P.canSeePost(db, 'u-maya', post)).toBe(false);
    expect(P.canSeePost(db, 'u-admin', post)).toBe(true);
  });
});

describe('membership and leader verification', () => {
  it('join requires leader approval', () => {
    as('u-sam');
    A.requestJoin('c-debate');
    expect(P.isActiveMember(getDB(), 'u-sam', 'c-debate')).toBe(false);
    as('u-priya');
    const m = P.membershipOf(getDB(), 'u-sam', 'c-debate')!;
    expect(() => A.approveMember(m.id)).toThrow();
    as('u-jordan');
    A.approveMember(m.id);
    expect(P.isActiveMember(getDB(), 'u-sam', 'c-debate')).toBe(true);
  });

  it('leader access requires admin verification', () => {
    as('u-sam');
    A.requestLeaderRole('c-key', 'Treasurer', '');
    expect(P.isLeader(getDB(), 'u-sam', 'c-key')).toBe(false);
    const r = getDB().leaderRequests.find((x) => x.userId === 'u-sam' && x.clubId === 'c-key')!;
    expect(() => A.decideLeaderRequest(r.id, true)).toThrow();
    as('u-admin');
    A.decideLeaderRequest(r.id, true);
    expect(P.isLeader(getDB(), 'u-sam', 'c-key')).toBe(true);
  });

  it('the last leader cannot leave', () => {
    as('u-jordan');
    expect(() => A.leaveClub('c-debate')).toThrow(/only leader/);
  });
});

describe('schedule', () => {
  it('cancellations override the regular meeting', () => {
    const ev = getDB().events.find((e) => e.id === 'e-1')!;
    const items = scheduleForClubs(getDB(), ['c-debate'], ev.date, 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('cancelled');
  });
});
