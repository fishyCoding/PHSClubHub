import { useState } from 'react';
import { AudienceBadge } from '../../components/PostCard';
import { Empty, Modal, Segmented, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { timeAgo } from '../../data/dates';
import { clubById, userById } from '../../data/selectors';
import { useDB } from '../../data/store';
import type { ID, Post } from '../../data/types';

type Show = 'open' | 'all-posts' | 'removed';

export function AdminModeration() {
  const db = useDB();
  const [show, setShow] = useState<Show>('open');
  const [removing, setRemoving] = useState<Post | null>(null);
  const open = db.reports.filter((r) => r.status === 'open');
  const reportedPostIds = [...new Set(open.map((r) => r.postId))];
  const removed = db.posts.filter((p) => p.removed);
  const recent = db.posts
    .filter((p) => !p.removed)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Moderation</h1>
          <p>Review reported posts. Administrators can see every post, including private messages to members.</p>
        </div>
        <Segmented<Show>
          value={show}
          onChange={setShow}
          options={[
            { id: 'open', label: `Reports (${reportedPostIds.length})` },
            { id: 'all-posts', label: 'Recent posts' },
            { id: 'removed', label: `Removed (${removed.length})` },
          ]}
        />
      </div>

      {show === 'open' &&
        (reportedPostIds.length === 0 ? (
          <div className="card">
            <Empty title="No open reports" />
          </div>
        ) : (
          <div className="stack">
            {reportedPostIds.map((pid) => {
              const post = db.posts.find((p) => p.id === pid);
              if (!post) return null;
              return <ReportedPost key={pid} post={post} reportIds={open.filter((r) => r.postId === pid).map((r) => r.id)} onRemove={() => setRemoving(post)} />;
            })}
          </div>
        ))}

      {show === 'all-posts' && (
        <div className="stack">
          {recent.map((p) => (
            <ModPost key={p.id} post={p}>
              <button className="btn btn-sm btn-danger" onClick={() => setRemoving(p)}>
                Remove
              </button>
            </ModPost>
          ))}
        </div>
      )}

      {show === 'removed' &&
        (removed.length === 0 ? (
          <div className="card">
            <Empty title="Nothing removed" />
          </div>
        ) : (
          <div className="stack">
            {removed.map((p) => (
              <RemovedPost key={p.id} post={p} />
            ))}
          </div>
        ))}

      {removing && <RemoveModal post={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}

function ModPost({ post, children }: { post: Post; children?: React.ReactNode }) {
  const db = useDB();
  return (
    <div className="card post">
      <div className="row-between">
        <div className="small">
          <strong>{clubById(db, post.clubId)?.name}</strong>
          <span className="muted">
            {' '}
            · {userById(db, post.authorId)?.name} · {timeAgo(post.createdAt)}
          </span>
        </div>
        <AudienceBadge post={post} />
      </div>
      <div className="post-title">{post.title}</div>
      {post.body && <div className="post-body small">{post.body}</div>}
      {children && <div className="row" style={{ justifyContent: 'flex-end' }}>{children}</div>}
    </div>
  );
}

function ReportedPost({ post, reportIds, onRemove }: { post: Post; reportIds: ID[]; onRemove: () => void }) {
  const db = useDB();
  const { run } = useToast();
  const reports = db.reports.filter((r) => reportIds.includes(r.id));
  return (
    <ModPost post={post}>
      <div className="stack" style={{ flex: 1, gap: 6 }}>
        {reports.map((r) => (
          <div key={r.id} className="callout warn small">
            <strong>{userById(db, r.reporterId)?.name}</strong> ({timeAgo(r.createdAt)}): {r.reason}
          </div>
        ))}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn btn-sm"
            onClick={() => run(() => reports.forEach((r) => A.dismissReport(r.id)), 'Report dismissed. Post stays up.')}
          >
            Dismiss report
          </button>
          <button className="btn btn-sm btn-primary" onClick={onRemove}>
            Remove post
          </button>
        </div>
      </div>
    </ModPost>
  );
}

function RemovedPost({ post }: { post: Post }) {
  const db = useDB();
  const { run } = useToast();
  return (
    <ModPost post={post}>
      <span className="small muted" style={{ flex: 1 }}>
        Removed by {userById(db, post.removed!.by)?.name} {timeAgo(post.removed!.at)}: {post.removed!.reason}
      </span>
      <button className="btn btn-sm" onClick={() => run(() => A.restorePost(post.id), 'Post restored')}>
        Restore
      </button>
    </ModPost>
  );
}

function RemoveModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { run } = useToast();
  const [reason, setReason] = useState('');
  return (
    <Modal
      title="Remove post"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (run(() => A.removePost(post.id, reason), 'Post removed')) onClose();
            }}
          >
            Remove
          </button>
        </>
      }
    >
      <p className="small">
        “{post.title}” will be hidden from everyone. The club leaders will see that it was removed and why. You can
        restore it later.
      </p>
      <label className="field">
        <span>Reason (shown to leaders)</span>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Violates the school code of conduct"
          autoFocus
        />
      </label>
    </Modal>
  );
}
