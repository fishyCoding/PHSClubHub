import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import * as A from '../data/actions';
import * as P from '../data/permissions';
import { inboxUnreadCount } from '../data/inbox';
import { resetDemoData, useDB } from '../data/store';
import type { User } from '../data/types';
import { Avatar, Icon, type IconName, Modal, useToast } from './ui';

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

export function Layout() {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const { toast } = useToast();
  const [menu, setMenu] = useState(false);

  const admin = me.role === 'admin';
  const leads = P.leadsAnyClub(db, me.id);
  const unread = inboxUnreadCount(db, me.id);
  const openReports = db.reports.filter((r) => r.status === 'open').length;
  const pendingLeaders = db.leaderRequests.filter((r) => r.status === 'pending').length;
  const pendingJoins = P.clubsLedBy(db, me.id).reduce(
    (n, c) => n + db.memberships.filter((m) => m.clubId === c.id && m.status === 'pending').length,
    0,
  );

  const items: NavItem[] = admin
    ? [
        { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
        { to: '/admin/clubs', label: 'Clubs', icon: 'users' },
        { to: '/admin/leaders', label: 'Leaders', icon: 'shield', count: pendingLeaders },
        { to: '/admin/moderation', label: 'Moderation', icon: 'flag', count: openReports },
        { to: '/admin/attendance', label: 'Attendance', icon: 'chart' },
        { to: '/explore', label: 'Explore', icon: 'compass' },
      ]
    : [
        { to: '/', label: 'Home', icon: 'home', end: true },
        { to: '/explore', label: 'Explore', icon: 'compass' },
        { to: '/schedule', label: 'Schedule', icon: 'calendar' },
        { to: '/my-clubs', label: 'My Clubs', icon: 'users' },
        ...(leads ? [{ to: '/lead', label: 'Lead', icon: 'star' as IconName, count: pendingJoins }] : []),
      ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to={admin ? '/admin' : '/'} className="brand">
            <span className="brand-mark">PHS</span>
            <span>Club Hub</span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}>
                <Icon name={it.icon} size={17} />
                {it.label}
                {!!it.count && <span className="count">{it.count}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="usermenu">
            <NavLink
              to="/inbox"
              className="inbox-btn"
              aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}
              title="Inbox"
            >
              <Icon name="inbox" size={20} />
              {unread > 0 && <span className="count dot">{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMenu(true)}
              aria-label="Account"
              style={{ padding: 2 }}
            >
              <Avatar user={me} />
              <span className="hide-mobile">{me.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Main">
        {items.slice(0, 5).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}>
            <Icon name={it.icon} size={22} />
            {it.label}
            {!!it.count && <span className="count dot">{it.count}</span>}
          </NavLink>
        ))}
      </nav>

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
                {leads && <span className="badge accent">Club leader</span>}
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
