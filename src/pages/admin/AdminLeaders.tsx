import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, ConfirmButton, Empty, Segmented, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { timeAgo } from '../../data/dates';
import { clubById, userById } from '../../data/selectors';
import { useDB } from '../../data/store';

type Show = 'pending' | 'leaders' | 'history';

export function AdminLeaders() {
  const db = useDB();
  const { run } = useToast();
  const [show, setShow] = useState<Show>('pending');
  const pending = db.leaderRequests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const history = db.leaderRequests
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));
  const leaders = db.memberships
    .filter((m) => m.role === 'leader' && m.status === 'active')
    .map((m) => ({ m, u: userById(db, m.userId)!, c: clubById(db, m.clubId)! }))
    .filter((x) => x.c && !x.c.archived)
    .sort((a, b) => a.c.name.localeCompare(b.c.name));

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Club leaders</h1>
          <p>
            Students request leader access for a club. Check with the advisor, then verify. Verified leaders can post,
            message members, edit meeting times, take attendance and approve members.
          </p>
        </div>
        <Segmented<Show>
          value={show}
          onChange={setShow}
          options={[
            { id: 'pending', label: `Requests (${pending.length})` },
            { id: 'leaders', label: `Verified (${leaders.length})` },
            { id: 'history', label: 'History' },
          ]}
        />
      </div>

      {show === 'pending' && (
        <div className="card card-flush">
          {pending.length === 0 ? (
            <Empty title="No requests waiting" />
          ) : (
            pending.map((r) => {
              const u = userById(db, r.userId)!;
              const c = clubById(db, r.clubId)!;
              return (
                <div key={r.id} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <Avatar user={u} size="lg" />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="strong">
                      {u.name} <span className="muted small">· grade {u.grade} · {u.email}</span>
                    </div>
                    <div className="small">
                      wants to be <strong>{r.position}</strong> of{' '}
                      <Link to={`/clubs/${c.id}`}>{c.name}</Link> <span className="muted">(advisor: {c.advisor})</span>
                    </div>
                    {r.note && <div className="callout small" style={{ marginTop: 6 }}>“{r.note}”</div>}
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      Requested {timeAgo(r.createdAt)}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn btn-sm btn-danger" onClick={() => run(() => A.decideLeaderRequest(r.id, false), 'Request denied')}>
                      Deny
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => run(() => A.decideLeaderRequest(r.id, true), `${u.name} verified as leader`)}>
                      Verify leader
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {show === 'leaders' && (
        <div className="card card-flush table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Leader</th>
                <th>Verified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leaders.map(({ m, u, c }) => (
                <tr key={m.id}>
                  <td className="strong">{c.name}</td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Avatar user={u} />
                      <div>
                        <div className="small strong">{u.name}</div>
                        <div className="tiny muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small muted">{m.approvedAt ? timeAgo(m.approvedAt) : '–'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ConfirmButton
                      className="btn btn-ghost btn-sm btn-danger"
                      label="Revoke"
                      title={`Revoke ${u.name}'s leader access to ${c.name}?`}
                      message="They will stay a member but lose leader tools immediately."
                      confirmLabel="Revoke"
                      onConfirm={() => run(() => A.revokeLeader(m.id), 'Leader access revoked')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show === 'history' && (
        <div className="card card-flush">
          {history.length === 0 ? (
            <Empty title="No decisions yet" />
          ) : (
            history.map((r) => (
              <div key={r.id} className="list-item small">
                <span className={`badge ${r.status === 'approved' ? 'ok' : 'danger'}`}>
                  {r.status === 'approved' ? 'Verified' : 'Denied'}
                </span>
                <span style={{ flex: 1 }}>
                  <strong>{userById(db, r.userId)?.name}</strong> as {r.position} of {clubById(db, r.clubId)?.name}
                </span>
                <span className="tiny muted">
                  by {userById(db, r.decidedBy)?.name} · {r.decidedAt && timeAgo(r.decidedAt)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
