import { Avatar, ConfirmButton, Empty, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { timeAgo } from '../../data/dates';
import * as P from '../../data/permissions';
import { activeMembers, followerCount, memberAttendance, pendingMembers, userById } from '../../data/selectors';
import { useDB } from '../../data/store';
import type { Club } from '../../data/types';
import { useMe } from '../../components/Layout';

export function MembersTab({ club }: { club: Club }) {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const pending = pendingMembers(db, club.id).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const active = activeMembers(db, club.id)
    .map((m) => ({ m, u: userById(db, m.userId)! }))
    .sort(
      (a, b) => Number(b.m.role === 'leader') - Number(a.m.role === 'leader') || a.u.name.localeCompare(b.u.name),
    );
  const admin = P.isAdmin(db, me.id);

  return (
    <div className="stack-lg">
      {club.hiddenMembership && (
        <div className="callout private small">
          This club has private membership. Members cannot see each other, and the member count is hidden from
          everyone else. Only leaders, the advisor and administrators see this list.
        </div>
      )}

      <div className="card card-flush">
        <div className="card-section row-between">
          <h3 style={{ margin: 0 }}>Join requests</h3>
          {pending.length > 1 && (
            <button
              className="btn btn-sm btn-ok"
              onClick={() =>
                run(() => pending.forEach((m) => A.approveMember(m.id)), `Approved ${pending.length} members`)
              }
            >
              Approve all
            </button>
          )}
        </div>
        {pending.length === 0 ? (
          <Empty title="No pending requests" />
        ) : (
          pending.map((m) => {
            const u = userById(db, m.userId)!;
            return (
              <div key={m.id} className="list-item">
                <Avatar user={u} />
                <div style={{ flex: 1 }}>
                  <div className="strong small">{u.name}</div>
                  <div className="tiny muted">
                    Grade {u.grade} · asked {timeAgo(m.requestedAt)}
                  </div>
                </div>
                <button className="btn btn-sm btn-ok" onClick={() => run(() => A.approveMember(m.id), `${u.name} approved`)}>
                  Approve
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => run(() => A.declineMember(m.id), 'Request declined')}>
                  Decline
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="card card-flush">
        <div className="card-section row-between">
          <h3 style={{ margin: 0 }}>Members ({active.length})</h3>
          <span className="muted small">{followerCount(db, club.id)} followers (not listed)</span>
        </div>
        {active.map(({ m, u }) => {
          const att = memberAttendance(db, club.id, u.id);
          return (
            <div key={m.id} className="list-item">
              <Avatar user={u} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong small">
                  {u.name} {u.id === me.id && <span className="muted">(you)</span>}
                </div>
                <div className="tiny muted">
                  Grade {u.grade}
                  {att.total > 0 && ` · attended ${att.present}/${att.total}`}
                </div>
              </div>
              {m.role === 'leader' ? (
                <span className="badge accent">Leader</span>
              ) : (
                <ConfirmButton
                  className="btn btn-ghost btn-sm btn-danger"
                  label="Remove"
                  title={`Remove ${u.name}?`}
                  message="They will stop getting members-only messages. They can ask to join again."
                  confirmLabel="Remove"
                  onConfirm={() => run(() => A.declineMember(m.id), `${u.name} removed`)}
                />
              )}
              {admin && m.role === 'leader' && (
                <ConfirmButton
                  className="btn btn-ghost btn-sm btn-danger"
                  label="Revoke leader"
                  title={`Revoke ${u.name}'s leader access?`}
                  message="They will stay a member but lose access to leader tools."
                  confirmLabel="Revoke"
                  onConfirm={() => run(() => A.revokeLeader(m.id), 'Leader access revoked')}
                />
              )}
            </div>
          );
        })}
      </div>
      {!admin && (
        <p className="muted small">
          To add or remove a co-leader, ask them to request leader access from My Clubs, or contact an administrator.
        </p>
      )}
    </div>
  );
}
