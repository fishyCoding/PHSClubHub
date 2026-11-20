import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { PostTypeTag } from '../components/PostCard';
import { ClubIcon, Empty, Icon, type IconName, Segmented, useToast } from '../components/ui';
import * as A from '../data/actions';
import { addDays, timeAgo, todayISO, toISODate } from '../data/dates';
import { inboxFor, type InboxItem, type InboxKind } from '../data/inbox';
import { clubById } from '../data/selectors';
import { useDB } from '../data/store';

type Filter = 'all' | 'unread' | 'updates' | 'activity';

const KIND: Record<InboxKind, { icon: IconName; label: string }> = {
  post: { icon: 'megaphone', label: 'Announcement' },
  private: { icon: 'lock', label: 'Message' },
  schedule: { icon: 'calendar', label: 'Schedule change' },
  membership: { icon: 'check', label: 'Membership' },
  'leader-request': { icon: 'shield', label: 'Leader request' },
  moderation: { icon: 'alert', label: 'Moderation' },
  attendance: { icon: 'check', label: 'Attendance' },
  'join-request': { icon: 'userPlus', label: 'Join request' },
  'admin-leader': { icon: 'shield', label: 'Needs verification' },
  'admin-report': { icon: 'flag', label: 'Report' },
};

function dayBucket(at: string): string {
  const d = toISODate(new Date(at));
  const today = todayISO();
  if (d === today) return 'Today';
  if (d === addDays(today, -1)) return 'Yesterday';
  if (d >= addDays(today, -7)) return 'This week';
  return 'Earlier';
}

export function Inbox() {
  const db = useDB();
  const me = useMe();
  const [filter, setFilter] = useState<Filter>('all');
  const all = inboxFor(db, me.id);
  const read = new Set(db.reads[me.id] ?? []);
  const unread = all.filter((i) => !read.has(i.id));

  const shown = all.filter((i) =>
    filter === 'unread'
      ? !read.has(i.id)
      : filter === 'updates'
        ? i.group === 'updates'
        : filter === 'activity'
          ? i.group !== 'updates'
          : true,
  );

  const groups: { label: string; items: InboxItem[] }[] = [];
  for (const it of shown) {
    const label = dayBucket(it.at);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(it);
    else groups.push({ label, items: [it] });
  }

  const hasUpdates = all.some((i) => i.group === 'updates');

  return (
    <div className="narrow stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Inbox</h1>
          <p>
            {unread.length > 0
              ? `${unread.length} unread`
              : all.length > 0
                ? 'You are all caught up'
                : 'Updates from your clubs will show up here'}
          </p>
        </div>
        <button className="btn btn-sm" disabled={unread.length === 0} onClick={() => A.markRead(unread.map((i) => i.id))}>
          <Icon name="check" size={15} />
          Mark all read
        </button>
      </div>

      {all.length > 0 && (
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread${unread.length ? ` · ${unread.length}` : ''}` },
            ...(hasUpdates ? [{ id: 'updates' as Filter, label: 'Club updates' }] : []),
            { id: 'activity', label: 'Activity' },
          ]}
        />
      )}

      {shown.length === 0 ? (
        <div className="card">
          <Empty title={filter === 'unread' ? 'Nothing unread' : 'Nothing here yet'}>
            {filter === 'all' &&
              'Club posts, schedule changes and decisions about your requests are collected here.'}
          </Empty>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="stack" style={{ gap: 6 }}>
            <h2 className="section-label">{g.label}</h2>
            <div className="card card-flush">
              {g.items.map((it) => (
                <InboxRow key={it.id} item={it} unread={!read.has(it.id)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function InboxRow({ item, unread }: { item: InboxItem; unread: boolean }) {
  const db = useDB();
  const nav = useNavigate();
  const { run } = useToast();
  const me = useMe();
  const club = item.clubId ? clubById(db, item.clubId) : undefined;
  const k = KIND[item.kind];
  const post = item.group === 'updates' ? db.posts.find((p) => p.id === item.id) : undefined;

  const open = () => {
    A.markRead([item.id]);
    nav(item.to);
  };

  return (
    <div
      className={`inbox-row${unread ? ' unread' : ''}`}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
    >
      <div className="inbox-icon">
        {club ? <ClubIcon club={club} /> : <span className="club-icon"><Icon name={k.icon} /></span>}
      </div>
      <div className="inbox-main">
        <div className="inbox-meta">
          {club && <span className="strong">{club.name}</span>}
          <span>{timeAgo(item.at)}</span>
        </div>
        <div style={{ margin: '4px 0 2px' }}>
          {post ? (
            <PostTypeTag post={post} viewerId={me.id} />
          ) : (
            <span
              className={`type-tag ${
                item.kind === 'attendance' ? (item.present ? 'present' : 'absent') : item.needsAction ? 'action' : 'activity'
              }`}
            >
              <Icon name={item.kind === 'attendance' && !item.present ? 'x' : k.icon} size={13} />
              {item.kind === 'attendance' ? (item.present ? 'Present' : 'Absent') : k.label}
            </span>
          )}
        </div>
        <div className="inbox-title">{item.title}</div>
        {item.body && <div className="inbox-body">{item.body}</div>}
        {item.kind === 'join-request' && item.ref && (
          <div className="row" style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => run(() => A.approveMember(item.ref!), 'Member approved')}
            >
              Approve
            </button>
            <button className="btn btn-sm" onClick={() => run(() => A.declineMember(item.ref!), 'Request declined')}>
              Decline
            </button>
          </div>
        )}
      </div>
      {unread && <span className="unread-dot" aria-label="Unread" />}
    </div>
  );
}
