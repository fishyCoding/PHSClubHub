import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { postType, PostTypeTag, type PostType } from '../components/PostCard';
import { RsvpButtons, RsvpCount } from '../components/Rsvp';
import { ClubIcon, Empty, Icon, Segmented, useToast } from '../components/ui';
import * as A from '../data/actions';
import { describeMeeting, formatDate, parseISODate, slotLabel, timeAgo, todayISO } from '../data/dates';
import { inboxUnread } from '../data/inbox';
import * as P from '../data/permissions';
import {
  clubById,
  feedFor,
  myClubIds,
  pendingMembers,
  scheduleFor,
  userById,
  type ScheduleItem,
} from '../data/selectors';
import { useDB } from '../data/store';
import type { Club, Post } from '../data/types';

type Filter = 'all' | PostType;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const db = useDB();
  const me = useMe();
  const feed = feedFor(db, me.id);
  const [filter, setFilter] = useState<Filter>('all');

  // Remember which posts were unread when the page opened, then mark them read.
  const [unreadAtOpen] = useState(() => {
    const read = new Set(db.reads[me.id] ?? []);
    return new Set(feed.filter((p) => !read.has(p.id)).map((p) => p.id));
  });
  useEffect(() => {
    const t = setTimeout(() => A.markRead([...unreadAtOpen]), 1500);
    return () => clearTimeout(t);
  }, [unreadAtOpen]);

  const pinned = feed.filter((p) => p.pinned && postType(p) === 'announcement');
  const rest = feed.filter((p) => !pinned.includes(p));
  const count = (t: PostType) => rest.filter((p) => postType(p) === t).length;
  const filtered = rest.filter((p) => filter === 'all' || postType(p) === filter);
  const shown = filtered.slice(0, 12);

  // Non-post activity (approvals, requests, …) lives in the inbox.
  const otherUnread = inboxUnread(db, me.id).filter((i) => i.group !== 'updates').length;

  const today = todayISO();
  const week = useMemo(() => scheduleFor(db, me.id, today, 8), [db, me.id, today]);
  const todays = week.filter((s) => s.date === today);
  const upcoming = week.filter((s) => s.date > today && s.status !== 'cancelled');
  const mine = myClubIds(db, me.id);
  const hasClubs = mine.joined.length + mine.following.length > 0;
  const newCount = unreadAtOpen.size;
  const withCount = (label: string, n: number) => (n ? `${label} ${n}` : label);

  return (
    <div className="two-col">
      <section className="stack-lg">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">{formatDate(today, { weekday: 'long', month: 'long' })}</div>
            <h1>
              {greeting()}, {me.name.split(' ')[0]}
            </h1>
            <p>
              {newCount > 0
                ? `${newCount} new post${newCount === 1 ? '' : 's'} from your clubs`
                : 'You are all caught up'}
            </p>
          </div>
        </div>

        {hasClubs && <TodayCard items={todays} next={upcoming[0]} />}

        {otherUnread > 0 && (
          <Link to="/inbox" className="callout inbox-nudge">
            <Icon name="inbox" />
            <span className="strong">
              {otherUnread} request{otherUnread === 1 ? '' : 's'} and approval{otherUnread === 1 ? '' : 's'} in your
              inbox
            </span>
            <span className="spacer" />
            <span aria-hidden="true">→</span>
          </Link>
        )}

        {!hasClubs ? (
          <div className="card">
            <Empty title="Welcome to Club Hub">
              Follow clubs to get their announcements, or join to also get messages from leaders.
              <div style={{ marginTop: 12 }}>
                <Link to="/explore" className="btn btn-primary">
                  Explore clubs
                </Link>
              </div>
            </Empty>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="stack" style={{ gap: 8 }}>
                <h2 className="section-label">
                  <Icon name="pin" size={13} /> Pinned announcements
                </h2>
                <div className="card card-flush pinned-list">
                  {pinned.map((p) => (
                    <FeedItem key={p.id} post={p} isNew={unreadAtOpen.has(p.id)} />
                  ))}
                </div>
              </section>
            )}

            <section className="stack" style={{ gap: 8 }}>
              <div className="row-between">
                <h2 className="section-label">Latest from your clubs</h2>
                <Segmented<Filter>
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { id: 'all', label: 'All' },
                    { id: 'announcement', label: withCount('Announcements', count('announcement')) },
                    { id: 'message', label: withCount('Messages', count('message')) },
                    { id: 'schedule', label: withCount('Schedule', count('schedule')) },
                  ]}
                />
              </div>
              {shown.length === 0 ? (
                <div className="card">
                  <Empty
                    title={
                      filter === 'message'
                        ? 'No messages'
                        : filter === 'schedule'
                          ? 'No schedule changes'
                          : 'No announcements yet'
                    }
                  >
                    {filter === 'message' && 'When a leader sends a message to you or a small group, it shows up here.'}
                  </Empty>
                </div>
              ) : (
                <div className="card card-flush">
                  {shown.map((p) => (
                    <FeedItem key={p.id} post={p} isNew={unreadAtOpen.has(p.id)} />
                  ))}
                  {filtered.length > shown.length && (
                    <Link to="/inbox" className="feed-more">
                      See older posts in your inbox
                    </Link>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <aside className="stack">
        {hasClubs && <ComingUp items={upcoming} />}
        <LeaderCard />
        {hasClubs && <YourClubs />}
        <Suggestions />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- main column

function FeedItem({ post, isNew }: { post: Post; isNew: boolean }) {
  const db = useDB();
  const me = useMe();
  const club = clubById(db, post.clubId)!;
  return (
    <Link
      to={`/clubs/${club.id}`}
      title={`Posted by ${userById(db, post.authorId)?.name ?? 'a leader'}`}
      className={`feed-item type-${postType(post)}${isNew ? ' unread' : ''}`}
    >
      <ClubIcon club={club} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="post-meta">
          <span className="post-source">{club.name}</span>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
        <div style={{ margin: '4px 0 2px' }}>
          <PostTypeTag post={post} viewerId={me.id} />
        </div>
        <div className="post-title">{post.title}</div>
        {post.body && <div className="feed-body">{post.body}</div>}
      </div>
      {isNew && <span className="unread-dot" aria-label="New" />}
    </Link>
  );
}

function TodayCard({ items, next }: { items: ScheduleItem[]; next?: ScheduleItem }) {
  const db = useDB();
  return (
    <div className="card today-card">
      <div className="today-head">
        <Icon name="sun" />
        <h3 style={{ margin: 0 }}>Today</h3>
        <span className="spacer" />
        <Link to="/schedule" className="small">
          Full schedule
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="muted small">
          No club meetings today.
          {next && (
            <>
              {' '}
              Next up: <strong className="text">{clubById(db, next.clubId)?.name}</strong>,{' '}
              {formatDate(next.date)} {slotLabel(next.slot)}.
            </>
          )}
        </p>
      ) : (
        <div className="today-list">
          {items.map((s, i) => {
            const club = clubById(db, s.clubId)!;
            return (
              <div key={i} className={`today-item ${s.status}`}>
                <span className="today-slot">{slotLabel(s.slot)}</span>
                <Link to={`/clubs/${club.id}`} className="strong text">
                  {club.name}
                </Link>
                <span className="muted small">
                  {s.status === 'cancelled' ? 'Cancelled' : s.room}
                  {s.status === 'moved' && ' · room changed'}
                  {s.status === 'extra' && s.title && ` · ${s.title}`}
                </span>
                <RsvpCount clubId={s.clubId} date={s.date} slot={s.slot} />
                <div style={{ marginTop: 6 }}>
                  <RsvpButtons
                    clubId={s.clubId}
                    date={s.date}
                    slot={s.slot}
                    cancelled={s.status === 'cancelled'}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- sidebar

function ComingUp({ items }: { items: ScheduleItem[] }) {
  const db = useDB();
  return (
    <div className="card card-flush">
      <div className="card-section row-between">
        <h3 style={{ margin: 0 }}>Coming up</h3>
        <span className="muted tiny">next 7 days</span>
      </div>
      {items.length === 0 ? (
        <div className="card-section muted small">No meetings this week.</div>
      ) : (
        items.slice(0, 5).map((s, i) => {
          const club = clubById(db, s.clubId)!;
          const d = parseISODate(s.date);
          return (
            <div key={i} className={`agenda-item ${s.status}`}>
              <span className="agenda-date">
                <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <strong>{d.getDate()}</strong>
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <Link to={`/clubs/${club.id}`} className="agenda-title text">
                  {club.name}
                </Link>
                <span className="agenda-sub">
                  {slotLabel(s.slot)} · {s.room}
                  {s.status === 'moved' ? ' (moved)' : ''}
                </span>
                {s.status === 'extra' && s.title && <span className="agenda-sub accent">{s.title}</span>}
                <span style={{ display: 'block', marginTop: 5 }}>
                  <RsvpButtons clubId={s.clubId} date={s.date} slot={s.slot} compact />
                </span>
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function LeaderCard() {
  const db = useDB();
  const me = useMe();
  const clubs = P.clubsLedBy(db, me.id);
  if (clubs.length === 0) return null;
  return (
    <div className="card card-flush">
      <div className="card-section">
        <h3 style={{ margin: 0 }}>Clubs you lead</h3>
      </div>
      {clubs.map((c) => {
        const pending = pendingMembers(db, c.id).length;
        return (
          <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
            <ClubIcon club={c} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="strong small">{c.name}</div>
              {pending > 0 ? (
                <Link to={`/lead/${c.id}?tab=members`} className="tiny">
                  {pending} join request{pending === 1 ? '' : 's'} waiting
                </Link>
              ) : (
                <div className="tiny muted">No pending requests</div>
              )}
              <div className="row" style={{ marginTop: 6, gap: 6 }}>
                <Link to={`/lead/${c.id}`} className="btn btn-sm btn-primary">
                  <Icon name="megaphone" size={14} />
                  New announcement
                </Link>
                <Link to={`/lead/${c.id}?tab=schedule`} className="btn btn-sm">
                  Schedule
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
    <div className="card card-flush">
      <div className="card-section row-between">
        <h3 style={{ margin: 0 }}>Your clubs</h3>
        <Link to="/my-clubs" className="small">
          Manage
        </Link>
      </div>
      {rows.slice(0, 6).map(({ club, role }) => (
        <Link key={club.id} to={`/clubs/${club.id}`} className="club-row">
          <ClubIcon club={club} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="agenda-title">{club.name}</span>
            <span className="agenda-sub">{club.meetings.map(describeMeeting).join(' · ') || 'No regular meeting'}</span>
          </span>
          <span className={`role-tag ${role.toLowerCase()}`} title={role === 'Pending' ? 'Waiting for a leader to approve' : undefined}>
            {role}
          </span>
        </Link>
      ))}
      {rows.length > 6 && (
        <Link to="/my-clubs" className="feed-more">
          {rows.length - 6} more
        </Link>
      )}
    </div>
  );
}

function Suggestions() {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const mine = myClubIds(db, me.id);
  const taken = new Set([...mine.joined, ...mine.pending, ...mine.following]);
  const myCats = new Set([...taken].map((id) => clubById(db, id)?.category));
  // Clubs in categories you already like first, then alphabetical.
  const ideas = db.clubs
    .filter((c) => !c.archived && !taken.has(c.id))
    .sort((a, b) => Number(myCats.has(b.category)) - Number(myCats.has(a.category)) || a.name.localeCompare(b.name))
    .slice(0, 3);
  if (ideas.length === 0) return null;
  return (
    <div className="card card-flush">
      <div className="card-section row-between">
        <h3 style={{ margin: 0 }}>Clubs you might like</h3>
        <Link to="/explore" className="small">
          Explore
        </Link>
      </div>
      {ideas.map((c) => (
        <div key={c.id} className="club-row">
          <ClubIcon club={c} />
          <Link to={`/clubs/${c.id}`} style={{ flex: 1, minWidth: 0, color: 'inherit' }}>
            <span className="agenda-title">{c.name}</span>
            <span className="agenda-sub">
              {c.category}
              {c.meetings[0] && ` · ${describeMeeting(c.meetings[0])}`}
            </span>
          </Link>
          <button className="btn btn-sm" onClick={() => run(() => A.follow(c.id), `Following ${c.name}`)}>
            <Icon name="plus" size={14} />
            Follow
          </button>
        </div>
      ))}
    </div>
  );
}
