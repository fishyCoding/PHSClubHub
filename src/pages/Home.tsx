import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { postType, PostTypeTag } from '../components/PostCard';
import { RSVP_LABEL, RsvpButtons, RsvpCount } from '../components/Rsvp';
import { ClubIcon, clubColor, Empty, Icon, pct, Sparkline } from '../components/ui';
import * as A from '../data/actions';
import { addDays, formatDate, parseISODate, slotLabel, timeAgo, todayISO } from '../data/dates';
import { inboxUnread } from '../data/inbox';
import * as P from '../data/permissions';
import {
  clubById,
  feedFor,
  myClubIds,
  pendingMembers,
  rsvpOf,
  scheduleFor,
  userById,
  type ScheduleItem,
} from '../data/selectors';
import { change, clubStats } from '../data/stats';
import { useDB } from '../data/store';
import { recentSessions } from './lead/AttendanceTab';
import type { Club, Post } from '../data/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dayName(date: string, today: string) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatDate(date, { weekday: 'long' });
}

export function Home() {
  const db = useDB();
  const me = useMe();
  const today = todayISO();
  const feed = feedFor(db, me.id);

  // Remember which posts were unread when the page opened, then mark them read.
  const [unreadAtOpen] = useState(() => {
    const read = new Set(db.reads[me.id] ?? []);
    return new Set(feed.filter((p) => !read.has(p.id)).map((p) => p.id));
  });
  useEffect(() => {
    const t = setTimeout(() => A.markRead([...unreadAtOpen]), 1500);
    return () => clearTimeout(t);
  }, [unreadAtOpen]);

  const week = useMemo(() => scheduleFor(db, me.id, today, 7), [db, me.id, today]);
  const live = week.filter((s) => s.status !== 'cancelled');
  const upNext = scheduleFor(db, me.id, today, 14).find((s) => s.status !== 'cancelled');
  const mine = myClubIds(db, me.id);
  const hasClubs = mine.joined.length + mine.following.length > 0;
  const newCount = unreadAtOpen.size;

  // Pinned announcements first, then newest.
  const latest = [...feed]
    .sort((a, b) => Number(b.pinned && postType(b) === 'announcement') - Number(a.pinned && postType(a) === 'announcement'))
    .slice(0, 6);

  if (!hasClubs) {
    return (
      <div className="stack-lg">
        <Header name={me.name} today={today} line="Let's find you some clubs." />
        <div className="card">
          <Empty title="Welcome to Club Hub">
            Follow clubs to get their announcements, or join to also get messages from leaders and RSVP to meetings.
            <div style={{ marginTop: 12 }}>
              <Link to="/explore" className="btn btn-primary">
                Explore clubs
              </Link>
            </div>
          </Empty>
        </div>
      </div>
    );
  }

  const summary = [
    `${live.length} meeting${live.length === 1 ? '' : 's'} this week`,
    newCount > 0 ? `${newCount} new post${newCount === 1 ? '' : 's'}` : 'no new posts',
  ].join(' · ');

  return (
    <div className="stack-lg">
      <Header name={me.name} today={today} line={summary} />

      {upNext ? <UpNext item={upNext} today={today} /> : null}

      <NeedsYou week={week} skip={upNext} />

      <div className="two-col">
        <section className="stack" style={{ gap: 8 }}>
          <div className="section-head">
            <h2>Latest posts</h2>
            <Link to="/inbox" className="small">
              See all
            </Link>
          </div>
          {latest.length === 0 ? (
            <div className="card">
              <Empty title="No posts yet" />
            </div>
          ) : (
            <div className="card card-flush">
              {latest.map((p) => (
                <FeedItem key={p.id} post={p} isNew={unreadAtOpen.has(p.id)} />
              ))}
            </div>
          )}
        </section>

        <aside className="stack-lg">
          <ThisWeek items={week} today={today} />
          <LeaderSummary />
          <YourClubs />
        </aside>
      </div>
    </div>
  );
}

function Header({ name, today, line }: { name: string; today: string; line: string }) {
  return (
    <div className="page-head" style={{ marginBottom: 0 }}>
      <div>
        <div className="eyebrow">{formatDate(today, { weekday: 'long', month: 'long' })}</div>
        <h1>
          {greeting()}, {name.split(' ')[0]}
        </h1>
        <p>{line}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- focal point

function UpNext({ item, today }: { item: ScheduleItem; today: string }) {
  const db = useDB();
  const club = clubById(db, item.clubId)!;
  return (
    <section className="upnext" style={{ ['--club' as string]: clubColor(club) }}>
      <div className="upnext-main">
        <div className="upnext-eyebrow">Up next</div>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
          <ClubIcon club={club} size="lg" />
          <div style={{ minWidth: 0 }}>
            <Link to={`/clubs/${club.id}`} className="upnext-club">
              {club.name}
            </Link>
            <div className="upnext-when">
              {dayName(item.date, today)}, {slotLabel(item.slot)} · {item.room}
              {item.status === 'moved' && ' (room changed)'}
            </div>
            {item.status === 'extra' && item.title && <div className="upnext-extra">{item.title}</div>}
          </div>
        </div>
      </div>
      <div className="upnext-side">
        <div className="small strong">Are you coming?</div>
        <RsvpButtons clubId={item.clubId} date={item.date} slot={item.slot} />
        <RsvpCount clubId={item.clubId} date={item.date} slot={item.slot} />
      </div>
    </section>
  );
}

/** A short to-do list: unanswered RSVPs, join requests, inbox items. */
function NeedsYou({ week, skip }: { week: ScheduleItem[]; skip?: ScheduleItem }) {
  const db = useDB();
  const me = useMe();
  const unanswered = week.filter(
    (s) =>
      s.status !== 'cancelled' &&
      !(skip && s.clubId === skip.clubId && s.date === skip.date && s.slot === skip.slot) &&
      P.canRsvp(db, me.id, s.clubId) &&
      !rsvpOf(db, me.id, s.clubId, s.date, s.slot),
  );
  const requests = P.clubsLedBy(db, me.id)
    .map((c) => ({ c, n: pendingMembers(db, c.id).length }))
    .filter((x) => x.n > 0);
  const inbox = inboxUnread(db, me.id).filter((i) => i.group !== 'updates' && i.kind !== 'join-request').length;
  // Leaders: meetings from the last week with no attendance yet.
  const roll = P.clubsLedBy(db, me.id)
    .map((c) => ({ c, n: recentSessions(db, c.id).filter((s) => !s.record && s.date >= addDays(todayISO(), -7)).length }))
    .filter((x) => x.n > 0);

  if (unanswered.length + requests.length + inbox + roll.length === 0) return null;
  const shown = unanswered.slice(0, 3);
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="section-head">
        <h2>Needs your attention</h2>
      </div>
      <div className="card card-flush">
        {requests.map(({ c, n }) => (
          <Link key={c.id} to={`/lead/${c.id}?tab=members`} className="todo">
            <span className="todo-icon join">
              <Icon name="userPlus" size={16} />
            </span>
            <span className="todo-text">
              <strong>
                {n} join request{n === 1 ? '' : 's'}
              </strong>{' '}
              for {c.name}
            </span>
            <span className="todo-go">Review →</span>
          </Link>
        ))}
        {roll.map(({ c, n }) => (
          <Link key={'roll' + c.id} to={`/lead/${c.id}?tab=attendance`} className="todo">
            <span className="todo-icon join">
              <Icon name="check" size={16} />
            </span>
            <span className="todo-text">
              <strong>Take attendance</strong> for {c.name}
              <span className="muted">
                {' '}
                · {n} meeting{n === 1 ? '' : 's'} not recorded
              </span>
            </span>
            <span className="todo-go">Start →</span>
          </Link>
        ))}
        {shown.map((s, i) => {
          const club = clubById(db, s.clubId)!;
          return (
            <div key={i} className="todo">
              <span className="todo-icon rsvp">
                <Icon name="help" size={16} />
              </span>
              <span className="todo-text">
                <strong>RSVP</strong> to {club.name}
                <span className="muted">
                  {' '}
                  · {formatDate(s.date)} {slotLabel(s.slot)}
                </span>
              </span>
              <RsvpButtons clubId={s.clubId} date={s.date} slot={s.slot} compact />
            </div>
          );
        })}
        {unanswered.length > shown.length && (
          <Link to="/schedule" className="todo">
            <span className="todo-icon rsvp">
              <Icon name="calendar" size={16} />
            </span>
            <span className="todo-text">
              {unanswered.length - shown.length} more meeting{unanswered.length - shown.length === 1 ? '' : 's'} to
              answer
            </span>
            <span className="todo-go">Schedule →</span>
          </Link>
        )}
        {inbox > 0 && (
          <Link to="/inbox" className="todo">
            <span className="todo-icon inbox">
              <Icon name="inbox" size={16} />
            </span>
            <span className="todo-text">
              <strong>{inbox}</strong> new update{inbox === 1 ? '' : 's'} in your inbox
              <span className="muted"> · attendance, approvals and requests</span>
            </span>
            <span className="todo-go">Open →</span>
          </Link>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- feed

function FeedItem({ post, isNew }: { post: Post; isNew: boolean }) {
  const db = useDB();
  const me = useMe();
  const club = clubById(db, post.clubId)!;
  return (
    <Link
      to={`/clubs/${club.id}`}
      title={`Posted by ${userById(db, post.authorId)?.name ?? 'a leader'}`}
      className={`feed-item${isNew ? ' unread' : ''}`}
    >
      <ClubIcon club={club} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="post-meta">
          <span className="post-source">{club.name}</span>
          <span>{timeAgo(post.createdAt)}</span>
          {post.pinned && (
            <span className="meta-tag accent">
              <Icon name="pin" size={12} />
              Pinned
            </span>
          )}
        </div>
        <div className="post-title">{post.title}</div>
        {post.body && <div className="feed-body">{post.body}</div>}
        <div style={{ marginTop: 6 }}>
          <PostTypeTag post={post} viewerId={me.id} />
        </div>
      </div>
      {isNew && <span className="unread-dot" aria-label="New" />}
    </Link>
  );
}

// ---------------------------------------------------------------- sidebar

function ThisWeek({ items, today }: { items: ScheduleItem[]; today: string }) {
  const db = useDB();
  const me = useMe();
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="section-head">
        <h2>This week</h2>
        <Link to="/schedule" className="small">
          Schedule
        </Link>
      </div>
      <div className="card card-flush">
        {items.length === 0 ? (
          <div className="card-section muted small">No meetings this week.</div>
        ) : (
          items.slice(0, 6).map((s, i) => {
            const club = clubById(db, s.clubId)!;
            const d = parseISODate(s.date);
            const mine = rsvpOf(db, me.id, s.clubId, s.date, s.slot);
            return (
              <Link key={i} to={`/clubs/${club.id}`} className={`week-row ${s.status}`}>
                <span className={`agenda-date${s.date === today ? ' today' : ''}`}>
                  <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <strong>{d.getDate()}</strong>
                </span>
                <span className="week-bar" style={{ background: clubColor(club) }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="agenda-title">{club.name}</span>
                  <span className="agenda-sub">
                    {s.status === 'cancelled' ? 'Cancelled' : `${slotLabel(s.slot)} · ${s.room}`}
                  </span>
                </span>
                {s.status !== 'cancelled' && mine && (
                  <span className={`rsvp-tally ${mine}`}>{mine === 'going' ? '✓ Going' : RSVP_LABEL[mine]}</span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function LeaderSummary() {
  const db = useDB();
  const me = useMe();
  const clubs = P.clubsLedBy(db, me.id);
  if (clubs.length === 0) return null;
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="section-head">
        <h2>Your club's turnout</h2>
      </div>
      <div className="card card-flush">
        {clubs.map((c) => {
          const st = clubStats(db, c.id, 30);
          const d = change(st.current.avgRate, st.previous?.avgRate);
          return (
            <Link key={c.id} to={`/stats/${c.id}`} className="club-row">
              <ClubIcon club={c} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="agenda-title">{c.name}</span>
                <span className="agenda-sub">
                  {st.current.meetings ? (
                    <>
                      <span className="strong text">{pct(st.current.avgRate)}</span> of members, last 30 days
                      {d !== null && Math.abs(d) >= 0.01 && (
                        <span className={`delta-inline ${d > 0 ? 'up' : 'down'}`}>
                          {' '}
                          {d > 0 ? '▲' : '▼'} {Math.abs(Math.round(d * 100))}%
                        </span>
                      )}
                    </>
                  ) : (
                    'No attendance yet'
                  )}
                </span>
              </span>
              {st.points.length > 0 && <Sparkline values={st.points.slice(-8).map((p) => p.rate)} />}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function YourClubs() {
  const db = useDB();
  const me = useMe();
  const mine = myClubIds(db, me.id);
  const rows: { club: Club; role: string }[] = [];
  const add = (ids: string[], role: (id: string) => string) => {
    for (const id of ids) {
      const c = clubById(db, id);
      if (c && !c.archived) rows.push({ club: c, role: role(id) });
    }
  };
  add(mine.joined, (id) => (P.isLeader(db, me.id, id) ? 'Leader' : 'Member'));
  add(mine.pending, () => 'Pending');
  add(mine.following, () => 'Following');
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="section-head">
        <h2>Your clubs</h2>
        <Link to="/explore" className="small">
          Find more
        </Link>
      </div>
      <div className="club-chips">
        {rows.map(({ club, role }) => (
          <Link key={club.id} to={`/clubs/${club.id}`} className="club-chip" title={`${club.name} · ${role}`}>
            <ClubIcon club={club} />
            <span className="club-chip-name">{club.name}</span>
            <span className={`role-tag ${role.toLowerCase()}`}>{role}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
