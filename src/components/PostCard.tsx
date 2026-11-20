import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as A from '../data/actions';
import { timeAgo } from '../data/dates';
import * as P from '../data/permissions';
import { clubById, isRead, userById } from '../data/selectors';
import { useDB } from '../data/store';
import type { ID, Post } from '../data/types';
import { Avatar, ClubIcon, Modal, useToast } from './ui';

export function AudienceBadge({ post }: { post: Post }) {
  const db = useDB();
  switch (post.audience.type) {
    case 'public':
      return post.kind === 'schedule' ? <span className="badge info">Schedule change</span> : null;
    case 'members':
      return <span className="badge private">Members only</span>;
    case 'selected': {
      const names = post.audience.userIds.map((id) => userById(db, id)?.name.split(' ')[0] ?? '?');
      return (
        <span className="badge private" title={names.join(', ')}>
          Private · {names.length <= 3 ? names.join(', ') : `${names.length} members`}
        </span>
      );
    }
  }
}

export function PostCard({
  post,
  viewerId,
  showClub = true,
  highlightUnread = false,
}: {
  post: Post;
  viewerId: ID;
  showClub?: boolean;
  highlightUnread?: boolean;
}) {
  const db = useDB();
  const { run } = useToast();
  const club = clubById(db, post.clubId);
  const author = userById(db, post.authorId);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const unread = highlightUnread && !isRead(db, viewerId, post.id);
  const canManage = P.canManageClub(db, viewerId, post.clubId);

  return (
    <article className={`card post${unread ? ' unread' : ''}${post.removed ? ' removed' : ''}`}>
      <div className="post-head">
        {showClub && club ? (
          <ClubIcon club={club} />
        ) : author ? (
          <Avatar user={author} />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          {showClub && club && (
            <Link to={`/clubs/${club.id}`} className="strong" style={{ color: 'var(--text)' }}>
              {club.name}
            </Link>
          )}
          <div className="post-meta">
            {author?.name ?? 'Unknown'} · {timeAgo(post.createdAt)}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {post.pinned && <span className="badge accent">Pinned</span>}
          <AudienceBadge post={post} />
          {unread && <span className="badge accent">New</span>}
        </div>
      </div>
      <div className="post-title">{post.title}</div>
      {post.body && <div className="post-body">{post.body}</div>}
      {post.removed && (
        <div className="callout warn">Removed by a moderator: {post.removed.reason}</div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {canManage && !post.removed && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => run(() => A.togglePin(post.id))}>
              {post.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={() => run(() => A.deletePost(post.id), 'Post deleted')}
            >
              Delete
            </button>
          </>
        )}
        {P.canReport(db, viewerId, post) && !post.removed && (
          <button className="btn btn-ghost btn-sm muted" onClick={() => setReporting(true)}>
            Report
          </button>
        )}
      </div>
      {reporting && (
        <Modal
          title="Report this post"
          onClose={() => setReporting(false)}
          actions={
            <>
              <button className="btn" onClick={() => setReporting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!reason.trim()}
                onClick={() => {
                  if (run(() => A.reportPost(post.id, reason), 'Thanks. An administrator will review it.')) {
                    setReporting(false);
                    setReason('');
                  }
                }}
              >
                Send report
              </button>
            </>
          }
        >
          <p className="muted small">
            Reports go to school administrators, not to the club leaders. Your name is visible to administrators only.
          </p>
          <label className="field">
            <span>What is wrong with this post?</span>
            <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
    </article>
  );
}
