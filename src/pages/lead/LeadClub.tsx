import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMe } from '../../components/Layout';
import { ClubIcon, Empty, Tabs } from '../../components/ui';
import * as P from '../../data/permissions';
import { clubById, pendingMembers } from '../../data/selectors';
import { useDB } from '../../data/store';
import { NotFound } from '../NotFound';
import { AttendanceTab } from './AttendanceTab';
import { ClubInfoTab } from './ClubInfoTab';
import { MembersTab } from './MembersTab';
import { PostsTab } from './PostsTab';
import { ScheduleTab } from './ScheduleTab';

/** /lead: pick which club to manage. */
export function LeadIndex() {
  const db = useDB();
  const me = useMe();
  if (P.isAdmin(db, me.id)) return <Navigate to="/admin/clubs" replace />;
  const clubs = P.clubsLedBy(db, me.id);
  if (clubs.length === 1) return <Navigate to={`/lead/${clubs[0].id}`} replace />;
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Clubs you lead</h1>
          <p>Pick a club to manage.</p>
        </div>
      </div>
      {clubs.length === 0 ? (
        <div className="card">
          <Empty title="You don't lead any clubs yet">
            Request leader access from <Link to="/my-clubs">My Clubs</Link>. An administrator will verify it.
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cards">
          {clubs.map((c) => {
            const pending = pendingMembers(db, c.id).length;
            return (
              <Link key={c.id} to={`/lead/${c.id}`} className="card club-card">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <ClubIcon club={c} />
                  <h3 style={{ margin: 0, flex: 1 }}>{c.name}</h3>
                </div>
                {pending > 0 ? (
                  <span className="badge warn">{pending} join request{pending === 1 ? '' : 's'}</span>
                ) : (
                  <span className="muted small">No pending requests</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Tab = 'posts' | 'schedule' | 'attendance' | 'members' | 'info';

export function LeadClub() {
  const { clubId } = useParams();
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<Tab>('posts');
  const club = clubById(db, clubId);
  if (!club) return <NotFound what="club" />;
  if (!P.canManageClub(db, me.id, club.id)) {
    return (
      <div className="card">
        <Empty title="Leaders only">
          Only verified leaders of {club.name} can manage it. <Link to={`/clubs/${club.id}`}>View club page</Link>
        </Empty>
      </div>
    );
  }
  const pending = pendingMembers(db, club.id).length;
  const others = P.clubsLedBy(db, me.id).filter((c) => c.id !== club.id);

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <ClubIcon club={club} size="lg" />
          <div>
            <div className="muted small">Managing</div>
            <h1>{club.name}</h1>
          </div>
        </div>
        <div className="row">
          {others.length > 0 && (
            <select
              className="input"
              style={{ width: 'auto' }}
              value=""
              onChange={(e) => e.target.value && (window.location.hash = `#/lead/${e.target.value}`)}
              aria-label="Switch club"
            >
              <option value="">Switch club…</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Link to={`/clubs/${club.id}`} className="btn">
            View public page
          </Link>
        </div>
      </div>
      {P.isAdmin(db, me.id) && !P.isLeader(db, me.id, club.id) && (
        <div className="callout warn small">You are viewing this club as an administrator.</div>
      )}
      <div>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'posts', label: 'Updates & messages' },
            { id: 'schedule', label: 'Schedule' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'members', label: 'Members', count: pending },
            { id: 'info', label: 'Club info' },
          ]}
        />
        {tab === 'posts' && <PostsTab club={club} />}
        {tab === 'schedule' && <ScheduleTab club={club} />}
        {tab === 'attendance' && <AttendanceTab club={club} />}
        {tab === 'members' && <MembersTab club={club} />}
        {tab === 'info' && <ClubInfoTab club={club} />}
      </div>
    </div>
  );
}
