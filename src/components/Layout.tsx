import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as A from '../data/actions';
import { inboxUnreadCount } from '../data/inbox';
import * as P from '../data/permissions';
import { pendingMembers } from '../data/selectors';
import { resetDemoData, useDB } from '../data/store';
import type { User } from '../data/types';
import { type PageLink, QuickSearch } from './QuickSearch';
import { Avatar, ClubIcon, Icon, type IconName, Modal, useToast } from './ui';

export function useMe(): User {
  const db = useDB();
  const me = P.getUser(db, db.sessionUserId);
  if (!me) throw new Error('useMe() used outside a signed-in route');
  return me;
}

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  count?: number;
  end?: boolean;
}

function SideLink({ it }: { it: NavItem }) {
  return (
    <NavLink to={it.to} end={it.end} className="side-link">
      <Icon name={it.icon} size={18} />
      <span className="side-label">{it.label}</span>
      {!!it.count && <span className="count">{it.count}</span>}
    </NavLink>
  );
}

export function Layout() {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const loc = useLocation();
  const { toast } = useToast();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  const admin = me.role === 'admin';
  const led = P.clubsLedBy(db, me.id);
  const unread = inboxUnreadCount(db, me.id);
  const openReports = db.reports.filter((r) => r.status === 'open').length;
  const pendingLeaders = db.leaderRequests.filter((r) => r.status === 'pending').length;
  const pendingJoins = led.reduce((n, c) => n + pendingMembers(db, c.id).length, 0);

  // Ctrl/Cmd+K or "/" opens search (unless you're typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Close menus when the page changes.
  useEffect(() => setSearch(false), [loc.pathname]);

  const mainItems: NavItem[] = admin
    ? [
        { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
        { to: '/inbox', label: 'Inbox', icon: 'inbox', count: unread },
      ]
    : [
        { to: '/', label: 'Home', icon: 'home', end: true },
        { to: '/inbox', label: 'Inbox', icon: 'inbox', count: unread },
        { to: '/schedule', label: 'Schedule', icon: 'calendar' },
      ];
  const clubItems: NavItem[] = admin
    ? [
        { to: '/admin/clubs', label: 'All clubs', icon: 'users' },
        { to: '/explore', label: 'Explore', icon: 'compass' },
      ]
    : [
        { to: '/my-clubs', label: 'My clubs', icon: 'users' },
        { to: '/explore', label: 'Explore', icon: 'compass' },
      ];
  const adminItems: NavItem[] = admin
    ? [
        { to: '/admin/leaders', label: 'Leader requests', icon: 'shield', count: pendingLeaders },
        { to: '/admin/moderation', label: 'Moderation', icon: 'flag', count: openReports },
        { to: '/admin/attendance', label: 'Attendance', icon: 'chart' },
      ]
    : [];

  // Phones: five tabs at the bottom.
  const bottomItems: NavItem[] = admin
    ? [
        { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
        { to: '/admin/clubs', label: 'Clubs', icon: 'users' },
        { to: '/admin/leaders', label: 'Leaders', icon: 'shield', count: pendingLeaders },
        { to: '/admin/moderation', label: 'Reports', icon: 'flag', count: openReports },
        { to: '/admin/attendance', label: 'Attendance', icon: 'chart' },
      ]
    : [
        { to: '/', label: 'Home', icon: 'home', end: true },
        { to: '/schedule', label: 'Schedule', icon: 'calendar' },
        { to: '/explore', label: 'Explore', icon: 'compass' },
        { to: '/my-clubs', label: 'My clubs', icon: 'users' },
        ...(led.length ? [{ to: '/lead', label: 'Lead', icon: 'star' as IconName, count: pendingJoins }] : []),
      ];

  const pages: PageLink[] = [
    ...mainItems,
    ...clubItems,
    ...adminItems,
    ...led.map((c) => ({
      to: `/stats/${c.id}`,
      label: `${c.name} attendance stats`,
      icon: 'chart' as IconName,
      keywords: 'stats numbers turnout',
    })),
  ];

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <NavLink to={admin ? '/admin' : '/'} className="brand">
          <span className="brand-mark">PHS</span>
          <span>Club Hub</span>
        </NavLink>

        <button type="button" className="side-search" onClick={() => setSearch(true)}>
          <Icon name="search" size={16} />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>

        <nav className="side-group">
          {mainItems.map((it) => (
            <SideLink key={it.to} it={it} />
          ))}
        </nav>

        <nav className="side-group">
          <div className="side-heading">Clubs</div>
          {clubItems.map((it) => (
            <SideLink key={it.to} it={it} />
          ))}
        </nav>

        {led.length > 0 && (
          <nav className="side-group">
            <div className="side-heading">You lead</div>
            {led.map((c) => {
              const pending = pendingMembers(db, c.id).length;
              return (
                <div key={c.id} className="side-club">
                  <NavLink to={`/lead/${c.id}`} className="side-link">
                    <ClubIcon club={c} />
                    <span className="side-label">{c.name}</span>
                    {!!pending && <span className="count">{pending}</span>}
                  </NavLink>
                  <div className="side-sub">
                    <NavLink to={`/lead/${c.id}`} className="side-sublink">
                      Manage
                    </NavLink>
                    <NavLink to={`/stats/${c.id}`} className="side-sublink">
                      Stats
                    </NavLink>
                    <NavLink to={`/clubs/${c.id}`} className="side-sublink">
                      Club page
                    </NavLink>
                  </div>
                </div>
              );
            })}
          </nav>
        )}

        {adminItems.length > 0 && (
          <nav className="side-group">
            <div className="side-heading">Admin</div>
            {adminItems.map((it) => (
              <SideLink key={it.to} it={it} />
            ))}
          </nav>
        )}

        <span className="spacer" />

        <button type="button" className="side-me" onClick={() => setMenu(true)}>
          <Avatar user={me} />
          <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <span className="side-me-name">{me.name}</span>
            <span className="side-me-role">
              {admin ? me.title ?? 'Administrator' : `Grade ${me.grade}${led.length ? ' · Leader' : ''}`}
            </span>
          </span>
        </button>
      </aside>

      {/* Phones: slim top bar */}
      <header className="topbar">
        <NavLink to={admin ? '/admin' : '/'} className="brand">
          <span className="brand-mark">PHS</span>
          <span>Club Hub</span>
        </NavLink>
        <span className="spacer" />
        <button type="button" className="inbox-btn" onClick={() => setSearch(true)} aria-label="Search">
          <Icon name="search" size={20} />
        </button>
        <NavLink to="/inbox" className="inbox-btn" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
          <Icon name="inbox" size={20} />
          {unread > 0 && <span className="count dot">{unread > 99 ? '99+' : unread}</span>}
        </NavLink>
        <button type="button" className="inbox-btn" onClick={() => setMenu(true)} aria-label="Account">
          <Avatar user={me} />
        </button>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Main">
        {bottomItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}>
            <Icon name={it.icon} size={22} />
            {it.label}
            {!!it.count && <span className="count dot">{it.count}</span>}
          </NavLink>
        ))}
      </nav>

      {search && <QuickSearch pages={pages} userId={me.id} onClose={() => setSearch(false)} />}

      {menu && (
        <Modal title="Account" onClose={() => setMenu(false)}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Avatar user={me} size="lg" />
            <div>
              <div className="strong">{me.name}</div>
              <div className="muted small">{me.email}</div>
              <div className="row" style={{ marginTop: 4 }}>
                {admin ? (
                  <span className="badge accent">Administrator · {me.title}</span>
                ) : (
                  <span className="badge">Student · Grade {me.grade}</span>
                )}
                {led.length > 0 && <span className="badge accent">Club leader</span>}
              </div>
            </div>
          </div>
          <div className="callout small">
            This is a frontend prototype. Data is stored in this browser only, and sign-in will be
            replaced by school accounts when the backend is connected.
          </div>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setMenu(false);
                A.signOut();
                nav('/');
              }}
            >
              Switch account
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                resetDemoData();
                setMenu(false);
                toast('Demo data reset');
              }}
            >
              Reset demo data
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
