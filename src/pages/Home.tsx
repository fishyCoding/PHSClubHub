import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { AudienceBadge } from '../components/PostCard';
import { ClubIcon, Empty, Segmented } from '../components/ui';
import * as A from '../data/actions';
import { formatDate, timeAgo, todayISO } from '../data/dates';
import * as P from '../data/permissions';
import { clubById, feedFor, myClubIds, scheduleFor, userById } from '../data/selectors';
import { useDB } from '../data/store';
import type { Post } from '../data/types';

type Filter = 'all' | 'private' | 'schedule';

export function Home() {
  const db = useDB();
  const me = useMe();
  const [filter, setFilter] = useState<Filter>('all');
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

  const shown = feed.filter((p) =>
    filter === 'private'
      ? p.audience.type !== 'public'
      : filter === 'schedule'
        ? p.kind === 'schedule'
        : true,
  );

  const today = todayISO();
  const upcoming = useMemo(
    () => scheduleFor(db, me.id, today, 7).filter((s) => s.status !== 'cancelled' || s.date === today),
    [db, me.id, today],
  );
  const mine = myClubIds(db, me.id);
  const privateCount = feed.filter((p) => p.audience.type !== 'public' && unreadAtOpen.has(p.id)).length;

  return (
    <div className="two-col">
      <section className="stack">
        <div className="page-head" style={{ marginBottom: 4 }}>
          <div>
            <h1>Hi, {me.name.split(' ')[0]}</h1>
            <p>
              {unreadAtOpen.size > 0
                ? `${unreadAtOpen.size} new update${unreadAtOpen.size === 1 ? '' : 's'} from your clubs`
                : 'You are all caught up'}
              {privateCount > 0 && ` · ${privateCount} private`}
            </p>
          </div>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All' },
              { id: 'private', label: 'Private' },
              { id: 'schedule', label: 'Schedule' },
            ]}
          />
        </div>

        {mine.joined.length + mine.following.length === 0 ? (
          <div className="card">
            <Empty title="Welcome to Club Hub">
              Follow clubs to get their updates, or join to also get private messages from leaders.
              <div style={{ marginTop: 12 }}>
                <Link to="/explore" className="btn btn-primary">
                  Explore clubs
                </Link>
              </div>
            </Empty>
          </div>
        ) : shown.length === 0 ? (
          <div className="card">
            <Empty title="Nothing here yet" />
          </div>
        ) : (
          shown.map((p) => <FeedItem key={p.id} post={p} isNew={unreadAtOpen.has(p.id)} />)
        )}
      </section>

      <aside className="stack">
        <div className="card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Next 7 days</h3>
            <Link to="/schedule" className="small">
              Full schedule
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="muted small">No meetings coming up for your clubs.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {upcoming.slice(0, 6).map((s, i) => {
                const club = clubById(db, s.clubId)!;
                return (
                  <Link
                    key={i}
                    to={`/clubs/${club.id}`}
                    className={`slot ${s.relation === 'following' ? 'following' : ''} ${s.status}`}
                  >
                    <span className="slot-label">
                      {s.date === today ? 'Today' : formatDate(s.date)} · {s.slot}
                    </span>
                    <span className="strong">{club.name}</span>
                    <span className="muted">
                      {s.status === 'cancelled' ? 'Cancelled' : s.room}
                      {s.status === 'moved' && ' (moved)'}
                      {s.status === 'extra' && ` · ${s.title}`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Your clubs</h3>
          <div className="stack" style={{ gap: 8 }}>
            {[...mine.joined, ...mine.following].map((id) => {
              const c = clubById(db, id);
              if (!c || c.archived) return null;
              const leader = P.isLeader(db, me.id, id);
              return (
                <Link key={id} to={`/clubs/${id}`} className="row" style={{ color: 'inherit', flexWrap: 'nowrap' }}>
                  <ClubIcon club={c} />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small">{c.name}</div>
                    <div className="tiny muted">
                      {leader ? 'Leader' : mine.joined.includes(id) ? 'Member' : 'Following'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <Link to="/explore" className="btn btn-sm btn-block" style={{ marginTop: 12 }}>
            Find more clubs
          </Link>
        </div>
      </aside>
    </div>
  );
}

function FeedItem({ post, isNew }: { post: Post; isNew: boolean }) {
  const db = useDB();
  const club = clubById(db, post.clubId)!;
  const author = userById(db, post.authorId);
  return (
    <Link
      to={`/clubs/${club.id}`}
      className={`card post${isNew ? ' unread' : ''}`}
      style={{ color: 'inherit', textDecoration: 'none' }}
    >
      <div className="post-head">
        <ClubIcon club={club} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="strong">{club.name}</div>
          <div className="post-meta">
            {author?.name} · {timeAgo(post.createdAt)}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <AudienceBadge post={post} />
          {isNew && <span className="badge accent">New</span>}
        </div>
      </div>
      <div className="post-title">{post.title}</div>
      {post.body && <div className="post-body muted">{post.body}</div>}
    </Link>
  );
}
