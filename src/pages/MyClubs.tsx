import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { ClubIcon, Modal, useToast } from '../components/ui';
import * as A from '../data/actions';
import { describeMeeting, timeAgo } from '../data/dates';
import * as P from '../data/permissions';
import { clubById, myClubIds } from '../data/selectors';
import { useDB } from '../data/store';
import type { ID } from '../data/types';

export function MyClubs() {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const mine = myClubIds(db, me.id);
  const [requesting, setRequesting] = useState(false);
  const myRequests = db.leaderRequests
    .filter((r) => r.userId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const Section = ({ title, ids, kind }: { title: string; ids: ID[]; kind: 'joined' | 'pending' | 'following' }) => (
    <div className="card card-flush">
      <div className="card-section row-between">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="muted small">{ids.length}</span>
      </div>
      {ids.length === 0 ? (
        <div className="card-section muted small">
          {kind === 'joined'
            ? 'You have not joined any clubs yet.'
            : kind === 'pending'
              ? 'No pending requests.'
              : 'You are not following any other clubs.'}
        </div>
      ) : (
        ids.map((id) => {
          const c = clubById(db, id);
          if (!c) return null;
          const leader = P.isLeader(db, me.id, id);
          return (
            <div key={id} className="list-item">
              <ClubIcon club={c} />
              <Link to={`/clubs/${id}`} style={{ flex: 1, color: 'inherit', minWidth: 0 }}>
                <div className="strong">{c.name}</div>
                <div className="tiny muted">{c.meetings.map(describeMeeting).join(' · ') || 'No regular meeting'}</div>
              </Link>
              {leader && (
                <Link to={`/lead/${id}`} className="btn btn-sm btn-primary">
                  Manage
                </Link>
              )}
              {kind === 'pending' && (
                <button className="btn btn-sm" onClick={() => run(() => A.leaveClub(id), 'Request cancelled')}>
                  Cancel
                </button>
              )}
              {kind === 'following' && (
                <button className="btn btn-sm" onClick={() => run(() => A.unfollow(id), 'Unfollowed')}>
                  Unfollow
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="two-col">
      <div className="stack">
        <div className="page-head" style={{ marginBottom: 4 }}>
          <div>
            <h1>My clubs</h1>
            <p>Clubs you belong to, are waiting on, or follow.</p>
          </div>
          <Link to="/explore" className="btn">
            Explore clubs
          </Link>
        </div>
        <Section title="Member" ids={mine.joined} kind="joined" />
        {mine.pending.length > 0 && <Section title="Waiting for approval" ids={mine.pending} kind="pending" />}
        <Section title="Following" ids={mine.following} kind="following" />
      </div>

      <aside className="stack">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Are you a club leader?</h3>
          <p className="muted small">
            Leaders can post updates, change meeting times, take attendance and approve members. An administrator
            verifies every leader before they get access.
          </p>
          <button className="btn btn-primary" onClick={() => setRequesting(true)}>
            Request leader access
          </button>
        </div>
        <div className="card card-flush">
          <div className="card-section">
            <h3 style={{ margin: 0 }}>Your leader requests</h3>
          </div>
          {myRequests.length === 0 ? (
            <div className="card-section muted small">None yet.</div>
          ) : (
            myRequests.map((r) => (
              <div key={r.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <div className="strong small">{clubById(db, r.clubId)?.name}</div>
                  <div className="tiny muted">
                    {r.position} · {timeAgo(r.createdAt)}
                  </div>
                </div>
                <span
                  className={`badge ${r.status === 'approved' ? 'ok' : r.status === 'denied' ? 'danger' : 'warn'}`}
                >
                  {r.status === 'approved' ? 'Verified' : r.status === 'denied' ? 'Not approved' : 'Pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>

      {requesting && <LeaderRequestModal onClose={() => setRequesting(false)} />}
    </div>
  );
}

function LeaderRequestModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const options = db.clubs
    .filter((c) => !c.archived && !P.isLeader(db, me.id, c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [clubId, setClubId] = useState(options[0]?.id ?? '');
  const [position, setPosition] = useState('');
  const [note, setNote] = useState('');

  return (
    <Modal
      title="Request leader access"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!clubId || !position.trim()}
            onClick={() => {
              if (run(() => A.requestLeaderRole(clubId, position, note), 'Request sent to administrators')) onClose();
            }}
          >
            Send request
          </button>
        </>
      }
    >
      <label className="field">
        <span>Club</span>
        <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="hint">Don't see your club? Only administrators can create clubs. Ask the Activities Office.</span>
      </label>
      <label className="field">
        <span>Your position</span>
        <input
          className="input"
          placeholder="President, Captain, Co-founder…"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
      </label>
      <label className="field">
        <span>
          Note for the administrator <span className="hint">(optional)</span>
        </span>
        <textarea
          className="input"
          placeholder="e.g. Elected in October, our advisor can confirm."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </Modal>
  );
}
