import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClubBanner } from '../components/ClubBanner';
import { RelationBadge } from '../components/ClubCard';
import { useMe } from '../components/Layout';
import { PostCard } from '../components/PostCard';
import { RsvpButtons, RsvpCount } from '../components/Rsvp';
import {
  Avatar,
  ConfirmButton,
  Empty,
  matchesQuery,
  NoMatches,
  personFields,
  SearchBox,
  Tabs,
  useToast,
} from '../components/ui';
import * as A from '../data/actions';
import { describeMeeting, formatDate, slotLabel, todayISO } from '../data/dates';
import * as P from '../data/permissions';
import {
  activeMembers,
  clubById,
  clubPostsFor,
  followerCount,
  scheduleForClubs,
  upcomingEvents,
  userById,
} from '../data/selectors';
import { useDB } from '../data/store';
import type { Club } from '../data/types';
import { NotFound } from './NotFound';

type Tab = 'updates' | 'schedule' | 'members';

export function ClubPage() {
  const { clubId } = useParams();
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<Tab>('updates');
  const club = clubById(db, clubId);
  if (!club || (club.archived && !P.isAdmin(db, me.id))) return <NotFound what="club" />;

  const canSeeMembers = P.canSeeMembers(db, me.id, club);
  const posts = clubPostsFor(db, me.id, club.id);
  const leader = P.isLeader(db, me.id, club.id);
  const admin = P.isAdmin(db, me.id);

  return (
    <div className="stack-lg">
      <ClubBanner
        club={club}
        badges={
          <>
            <RelationBadge clubId={club.id} userId={me.id} />
            {club.archived && <span className="badge danger">Archived</span>}
          </>
        }
        meta={
          <>
            <span>{club.category}</span>
            <span>Advisor: {club.advisor}</span>
            <span>{club.hiddenMembership ? 'Private membership' : `${activeMembers(db, club.id).length} members`}</span>
            <span>{followerCount(db, club.id)} followers</span>
          </>
        }
        actions={
          <>
            {!admin && <MembershipButtons club={club} />}
            {(leader || admin) && (
              <Link to={`/lead/${club.id}`} className="btn btn-primary">
                Manage club
              </Link>
            )}
          </>
        }
      >
        <p>{club.description}</p>
      </ClubBanner>

      <div className="two-col">
        <div>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'updates', label: 'Updates' },
              { id: 'schedule', label: 'Meetings' },
              ...(canSeeMembers ? [{ id: 'members' as Tab, label: 'Members' }] : []),
            ]}
          />
          {tab === 'updates' && (
            <div className="stack">
              {!P.isActiveMember(db, me.id, club.id) && !admin && (
                <div className="callout private small">
                  Members also get private messages from leaders. Join the club to receive them.
                </div>
              )}
              {posts.length === 0 ? (
                <div className="card">
                  <Empty title="No updates yet" />
                </div>
              ) : (
                posts.map((p) => <PostCard key={p.id} post={p} viewerId={me.id} showClub={false} />)
              )}
            </div>
          )}
          {tab === 'schedule' && <ClubSchedule club={club} />}
          {tab === 'members' && canSeeMembers && <MemberList club={club} />}
        </div>

        <aside className="stack">
          <NextMeetingCard club={club} />
          <div className="card">
            <h3>When &amp; where</h3>
            <div className="stack" style={{ gap: 8 }}>
              {club.meetings.length === 0 && <p className="muted small">No regular meeting time yet.</p>}
              {club.meetings.map((m, i) => (
                <div key={i}>
                  <div className="strong">{describeMeeting(m)}</div>
                  <div className="muted small">
                    {m.room}
                    {m.note && ` · ${m.note}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <LeadersCard club={club} />
          {!canSeeMembers && (
            <div className="card small muted">
              {club.hiddenMembership
                ? 'This club keeps its membership private. Only leaders, the advisor and administrators can see who belongs.'
                : P.isActiveMember(db, me.id, club.id)
                  ? ''
                  : 'Only members can see who else is in the club.'}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MembershipButtons({ club }: { club: Club }) {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const m = P.membershipOf(db, me.id, club.id);
  const following = P.isFollowing(db, me.id, club.id);
  if (club.archived) return null;

  return (
    <>
      {!m && (
        <button className="btn btn-primary" onClick={() => run(() => A.requestJoin(club.id), 'Request sent to the club leaders')}>
          Join club
        </button>
      )}
      {m?.status === 'pending' && (
        <button className="btn" onClick={() => run(() => A.leaveClub(club.id), 'Request cancelled')}>
          Cancel join request
        </button>
      )}
      {m?.status === 'active' && (
        <ConfirmButton
          className="btn"
          label="Leave club"
          title={`Leave ${club.name}?`}
          message="You will stop getting members-only messages. You can ask to join again later."
          confirmLabel="Leave"
          onConfirm={() => run(() => A.leaveClub(club.id), `You left ${club.name}`)}
        />
      )}
      {m?.status !== 'active' &&
        (following ? (
          <button className="btn" onClick={() => run(() => A.unfollow(club.id), 'Unfollowed')}>
            Following
          </button>
        ) : (
          <button className="btn" onClick={() => run(() => A.follow(club.id), `Following ${club.name}`)}>
            + Follow
          </button>
        ))}
    </>
  );
}

function LeadersCard({ club }: { club: Club }) {
  const db = useDB();
  const leaders = activeMembers(db, club.id).filter((m) => m.role === 'leader');
  return (
    <div className="card">
      <h3>Leaders</h3>
      {leaders.length === 0 ? (
        <p className="muted small">No verified leaders yet.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {leaders.map((m) => {
            const u = userById(db, m.userId)!;
            return (
              <div key={m.id} className="row" style={{ flexWrap: 'nowrap' }}>
                <Avatar user={u} />
                <div>
                  <div className="strong small">{u.name}</div>
                  <div className="tiny muted">Grade {u.grade}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NextMeetingCard({ club }: { club: Club }) {
  const db = useDB();
  const next = scheduleForClubs(db, [club.id], todayISO(), 14).find((s) => s.status !== 'cancelled');
  if (!next) return null;
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row-between">
        <h3 style={{ margin: 0 }}>Next meeting</h3>
        <RsvpCount clubId={club.id} date={next.date} slot={next.slot} />
      </div>
      <div>
        <div className="strong">
          {next.date === todayISO() ? 'Today' : formatDate(next.date, { weekday: 'long' })}, {slotLabel(next.slot)}
        </div>
        <div className="muted small">
          {next.room}
          {next.status === 'moved' && ' (room changed)'}
          {next.status === 'extra' && next.title && ` · ${next.title}`}
        </div>
      </div>
      <RsvpButtons clubId={club.id} date={next.date} slot={next.slot} />
    </div>
  );
}

function ClubSchedule({ club }: { club: Club }) {
  const db = useDB();
  const events = upcomingEvents(db, club.id);
  const soon = scheduleForClubs(db, [club.id], todayISO(), 14);
  return (
    <div className="stack">
      <div className="card card-flush">
        <div className="card-section row-between">
          <h3 style={{ margin: 0 }}>Next two weeks</h3>
          <span className="muted tiny">Let the leaders know if you're coming</span>
        </div>
        {soon.length === 0 ? (
          <div className="card-section muted small">No meetings in the next two weeks.</div>
        ) : (
          soon.map((s, i) => (
            <div key={i} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="strong small" style={s.status === 'cancelled' ? { textDecoration: 'line-through' } : {}}>
                  {formatDate(s.date)} · {slotLabel(s.slot)}
                </div>
                <div className="tiny muted">
                  {s.status === 'cancelled' ? 'Cancelled' : s.room}
                  {s.status === 'moved' && ' (room changed)'}
                  {s.status === 'extra' && s.title && ` · ${s.title}`}
                </div>
                <RsvpCount clubId={club.id} date={s.date} slot={s.slot} />
              </div>
              <RsvpButtons clubId={club.id} date={s.date} slot={s.slot} cancelled={s.status === 'cancelled'} compact />
            </div>
          ))
        )}
      </div>
      <div className="card">
        <h3>Regular meetings</h3>
        {club.meetings.length === 0 ? (
          <p className="muted small">No regular meetings.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {club.meetings.map((m, i) => (
              <div key={i} className="row-between">
                <span className="strong">{describeMeeting(m)}</span>
                <span className="muted">
                  {m.room}
                  {m.note && ` · ${m.note}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card card-flush">
        <div className="card-section">
          <h3 style={{ margin: 0 }}>Upcoming changes &amp; events</h3>
        </div>
        {events.length === 0 ? (
          <div className="card-section muted small">Nothing out of the ordinary coming up.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="list-item">
              <span
                className={`badge ${e.kind === 'cancelled' ? 'danger' : e.kind === 'moved' ? 'warn' : 'info'}`}
              >
                {e.kind === 'cancelled' ? 'Cancelled' : e.kind === 'moved' ? 'Moved' : 'Event'}
              </span>
              <div style={{ flex: 1 }}>
                <div className="strong small">{e.title}</div>
                <div className="tiny muted">
                  {formatDate(e.date)} · {slotLabel(e.slot)} · {e.room}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MemberList({ club }: { club: Club }) {
  const db = useDB();
  const [q, setQ] = useState('');
  const all = activeMembers(db, club.id).map((m) => ({ m, u: userById(db, m.userId)! }));
  const members = all
    .filter(({ u, m }) => matchesQuery(q, ...personFields(u), m.role === 'leader' ? 'leader' : 'member'))
    .sort((a, b) => Number(b.m.role === 'leader') - Number(a.m.role === 'leader') || a.u.name.localeCompare(b.u.name));
  return (
    <div className="card card-flush">
      {club.hiddenMembership && (
        <div className="card-section callout private" style={{ borderRadius: 0 }}>
          Private membership: only you (as a leader or admin) can see this list.
        </div>
      )}
      <div className="card-section">
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${all.length} members`} count={members.length} />
      </div>
      {members.length === 0 && q && <NoMatches query={q} onClear={() => setQ('')} />}
      {members.map(({ m, u }) => (
        <div key={m.id} className="list-item">
          <Avatar user={u} />
          <div style={{ flex: 1 }}>
            <div className="strong small">{u.name}</div>
            <div className="tiny muted">Grade {u.grade}</div>
          </div>
          {m.role === 'leader' && <span className="badge accent">Leader</span>}
        </div>
      ))}
    </div>
  );
}
