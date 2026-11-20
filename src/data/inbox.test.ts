import { beforeEach, describe, expect, it } from 'vitest';
import * as A from './actions';
import { inboxFor, inboxUnreadCount } from './inbox';
import { createSeed } from './seed';
import { getDB, replaceDB } from './store';

function as(userId: string) {
  replaceDB({ ...getDB(), sessionUserId: userId });
}

beforeEach(() => {
  replaceDB(structuredClone(createSeed()));
});

describe('inbox', () => {
  it('includes feed posts but not your own posts', () => {
    const items = inboxFor(getDB(), 'u-maya');
    const posts = items.filter((i) => i.group === 'updates');
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.some((i) => i.id === 'p-1')).toBe(false); // Maya wrote p-1
  });

  it('leaders get pending join requests and can act on them', () => {
    const jr = inboxFor(getDB(), 'u-maya').filter((i) => i.kind === 'join-request');
    expect(jr.map((i) => i.title).join()).toContain('Sam Okoro');
    as('u-maya');
    A.approveMember(jr.find((i) => i.title.includes('Sam'))!.ref!);
    expect(inboxFor(getDB(), 'u-maya').some((i) => i.title.includes('Sam Okoro wants'))).toBe(false);
    expect(inboxFor(getDB(), 'u-sam').some((i) => i.kind === 'membership')).toBe(true);
  });

  it('old seed approvals are not shown as new activity', () => {
    expect(inboxFor(getDB(), 'u-priya').some((i) => i.kind === 'membership')).toBe(false);
  });

  it('students are told about leader request decisions', () => {
    as('u-admin');
    A.decideLeaderRequest('lr-2', false);
    const item = inboxFor(getDB(), 'u-sam').find((i) => i.kind === 'leader-request');
    expect(item?.title).toContain('not approved');
  });

  it('admins see pending verifications and open reports', () => {
    const kinds = inboxFor(getDB(), 'u-admin').map((i) => i.kind);
    expect(kinds).toContain('admin-leader');
    expect(kinds).toContain('admin-report');
    expect(inboxFor(getDB(), 'u-priya').some((i) => i.group === 'action')).toBe(false);
  });

  it('markRead clears unread count', () => {
    as('u-priya');
    const before = inboxUnreadCount(getDB(), 'u-priya');
    expect(before).toBeGreaterThan(0);
    A.markRead(inboxFor(getDB(), 'u-priya').map((i) => i.id));
    expect(inboxUnreadCount(getDB(), 'u-priya')).toBe(0);
  });
});
