import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as A from '../data/actions';
import { timeAgo } from '../data/dates';
import * as P from '../data/permissions';
import { clubById, isRead, userById } from '../data/selectors';
import { useDB } from '../data/store';
import type { ID, Post } from '../data/types';
import { Avatar, ClubIcon, Icon, Menu, type MenuItem, Modal, useToast } from './ui';

export type PostType = 'announcement' | 'message' | 'schedule';

/**
 * What kind of post this is, in plain words:
 *  - Announcement: a club-wide update (to everyone, or members only)
 *  - Message: sent to specific members
 *  - Schedule change: a cancellation, room change or extra meeting
 */
export function postType(post: Post): PostType {
  if (post.kind === 'schedule') return 'schedule';
  if (post.audience.type === 'selected') return 'message';
  return 'announcement';
}

export const POST_TYPE_LABEL: Record<PostType, string> = {
  announcement: 'Announcement',
  message: 'Message',
  schedule: 'Schedule change',
};

const POST_TYPE_ICON = { announcement: 'megaphone', message: 'mail', schedule: 'calendar' } as const;

/** Coloured pill saying what kind of post this is, plus who it went to. */
export function PostTypeTag({ post, viewerId }: { post: Post; viewerId?: ID }) {
  const db = useDB();
  const type = postType(post);
  let detail = '';
  let title: string | undefined;
  if (post.audience.type === 'members') detail = 'Members only';
  if (post.audience.type === 'selected') {
    const ids = post.audience.userIds;
    const names = ids.map((id) => userById(db, id)?.name.split(' ')[0] ?? '?');
    title = `Sent to ${names.join(', ')}`;
    detail =
      viewerId && ids.includes(viewerId)
        ? ids.length === 1
          ? 'To you'
          : `To you + ${ids.length - 1}`
        : ids.length <= 3
          ? `To ${names.join(', ')}`
          : `To ${ids.length} members`;
  }
  return (
    <span className={`type-tag ${type}`} title={title}>
      <Icon name={POST_TYPE_ICON[type]} size={13} />
      {POST_TYPE_LABEL[type]}
      {detail && (
        <span className="type-detail">
          {post.audience.type === 'members' && <Icon name="lock" size={11} />}
          {detail}
        </span>
      )}
    </span>
  );
}

/** @deprecated kept for older call sites; same as PostTypeTag. */
export function AudienceBadge({ post }: { post: Post }) {
  return <PostTypeTag post={post} />;
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

  const actions: MenuItem[] = [];
  if (canManage && !post.removed) {
    actions.push({ label: post.pinned ? 'Unpin' : 'Pin to top', onClick: () => run(() => A.togglePin(post.id)) });
    actions.push({ label: 'Delete', danger: true, onClick: () => run(() => A.deletePost(post.id), 'Post deleted') });
  }
  if (P.canReport(db, viewerId, post) && !post.removed) {
    actions.push({ label: 'Report…', onClick: () => setReporting(true) });
  }

  return (
    <article className={`card post${unread ? ' unread' : ''}${post.removed ? ' removed' : ''}`}>
      <div className="post-head">
        {showClub && club ? <ClubIcon club={club} /> : author ? <Avatar user={author} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          {showClub && club ? (
            <Link to={`/clubs/${club.id}`} className="post-source">
              {club.name}
            </Link>
          ) : (
            <span className="post-source">{author?.name ?? 'Unknown'}</span>
          )}
          <div className="post-meta">
            {showClub && <span>{author?.name ?? 'Unknown'}</span>}
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {unread && <span className="unread-dot" aria-label="New" />}
        <Menu items={actions} />
      </div>
      <div className="row" style={{ gap: 6 }}>
        <PostTypeTag post={post} viewerId={viewerId} />
        {post.pinned && (
          <span className="type-tag pinned">
            <Icon name="pin" size={13} />
            Pinned
          </span>
        )}
      </div>
      <div className="post-title">{post.title}</div>
      {post.body && <div className="post-body">{post.body}</div>}
      {post.removed && <div className="callout warn">Removed by a moderator: {post.removed.reason}</div>}
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
