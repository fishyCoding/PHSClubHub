// @vitest-environment jsdom
// Renders every page for each kind of user and fails on any runtime error.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createSeed } from './data/seed';
import { getDB, replaceDB } from './data/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(path: string, userId: string | null) {
  replaceDB({ ...structuredClone(createSeed()), sessionUserId: userId });
  window.location.hash = '#' + path;
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<App />));
  const text = el.textContent ?? '';
  await act(async () => root.unmount());
  el.remove();
  return text;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    throw new Error(args.map(String).join(' '));
  });
});

describe('pages render', () => {
  it('login', async () => {
    expect(await render('/', null)).toContain('Demo accounts');
  });

  const student = ['/', '/explore', '/clubs/c-robotics', '/clubs/c-gsa', '/schedule', '/my-clubs', '/lead', '/lead/c-robotics', '/nope'];
  for (const path of student) {
    it(`student leader ${path}`, async () => {
      const text = await render(path, 'u-maya');
      expect(text).toContain('Club Hub');
    });
  }

  it('regular student cannot open leader tools', async () => {
    expect(await render('/lead/c-robotics', 'u-priya')).toContain('Leaders only');
  });

  it('member of hidden club sees no member list tab', async () => {
    const text = await render('/clubs/c-gsa', 'u-priya');
    expect(text).toContain('Private membership');
    expect(text).not.toContain('Members0');
  });

  const admin = ['/admin', '/admin/clubs', '/admin/clubs?new=1', '/admin/leaders', '/admin/moderation', '/admin/attendance', '/lead/c-chess', '/explore', '/clubs/c-mind'];
  for (const path of admin) {
    it(`admin ${path}`, async () => {
      expect(await render(path, 'u-admin')).toContain('Club Hub');
    });
  }

  it('students are redirected away from admin', async () => {
    await render('/admin', 'u-priya');
    expect(window.location.hash).toBe('#/');
    expect(getDB().sessionUserId).toBe('u-priya');
  });
});
