import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MeetingsEditor } from '../../components/MeetingsEditor';
import { ClubIcon, Modal, Segmented, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { describeMeeting } from '../../data/dates';
import { activeMembers, followerCount, pendingMembers, userById } from '../../data/selectors';
import { useDB } from '../../data/store';
import { CATEGORIES, type Category, type Club } from '../../data/types';

type Show = 'active' | 'archived';

export function AdminClubs() {
  const db = useDB();
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState<Show>('active');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Club | null>(null);
  const creating = params.get('new') === '1';

  const clubs = db.clubs
    .filter((c) => (show === 'archived' ? c.archived : !c.archived))
    .filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Clubs</h1>
          <p>Only administrators can create clubs, change advisors, or set membership privacy.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}>
          + Create club
        </button>
      </div>
      <div className="row">
        <label className="search">
          <input className="input" placeholder="Search clubs" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Segmented<Show>
          value={show}
          onChange={setShow}
          options={[
            { id: 'active', label: 'Active' },
            { id: 'archived', label: 'Archived' },
          ]}
        />
      </div>
      <div className="card card-flush table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Club</th>
              <th>Meets</th>
              <th>Leaders</th>
              <th className="num">Members</th>
              <th className="num">Followers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clubs.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No clubs.
                </td>
              </tr>
            )}
            {clubs.map((c) => {
              const members = activeMembers(db, c.id);
              const leaders = members.filter((m) => m.role === 'leader');
              const pending = pendingMembers(db, c.id).length;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <ClubIcon club={c} />
                      <div>
                        <Link to={`/clubs/${c.id}`} className="strong" style={{ color: 'var(--text)' }}>
                          {c.name}
                        </Link>
                        <div className="row" style={{ gap: 4 }}>
                          <span className="tiny muted">{c.category}</span>
                          {c.hiddenMembership && <span className="badge private">Private</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="small">
                    {c.meetings.map((m, i) => (
                      <div key={i} className="nowrap">
                        {describeMeeting(m)}
                      </div>
                    ))}
                  </td>
                  <td className="small">
                    {leaders.length === 0 ? (
                      <span className="badge warn">None</span>
                    ) : (
                      leaders.map((m) => <div key={m.id}>{userById(db, m.userId)?.name}</div>)
                    )}
                  </td>
                  <td className="num">
                    {members.length}
                    {pending > 0 && <div className="tiny muted">+{pending} pending</div>}
                  </td>
                  <td className="num">{followerCount(db, c.id)}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>
                    <Link to={`/lead/${c.id}`} className="btn btn-ghost btn-sm">
                      Manage
                    </Link>
                    <button className="btn btn-sm" onClick={() => setEditing(c)}>
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {creating && <ClubForm onClose={() => setParams({})} />}
      {editing && <ClubForm club={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ClubForm({ club, onClose }: { club?: Club; onClose: () => void }) {
  const db = useDB();
  const { run } = useToast();
  const [name, setName] = useState(club?.name ?? '');
  const [description, setDescription] = useState(club?.description ?? '');
  const [category, setCategory] = useState<Category>(club?.category ?? 'Academic');
  const [advisor, setAdvisor] = useState(club?.advisor ?? '');
  const [meetings, setMeetings] = useState(club?.meetings ?? [{ day: 'Monday' as const, slot: 'lunch' as const, room: '' }]);
  const [hidden, setHidden] = useState(club?.hiddenMembership ?? false);
  const [leaderId, setLeaderId] = useState('');
  const students = db.users.filter((u) => u.role === 'student').sort((a, b) => a.name.localeCompare(b.name));

  const save = () => {
    const input = { name, description, category, advisor, meetings, hiddenMembership: hidden };
    const ok = run(() => {
      if (club) {
        A.updateClubAdmin(club.id, input);
        if (leaderId) A.assignLeader(leaderId, club.id);
      } else {
        const id = A.createClub(input);
        if (leaderId) A.assignLeader(leaderId, id);
      }
    }, club ? 'Club updated' : 'Club created');
    if (ok) onClose();
  };

  return (
    <Modal
      title={club ? `Edit ${club.name}` : 'Create a club'}
      onClose={onClose}
      actions={
        <>
          {club && (
            <button
              className="btn btn-danger"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                if (run(() => A.updateClubAdmin(club.id, { archived: !club.archived }), club.archived ? 'Club restored' : 'Club archived'))
                  onClose();
              }}
            >
              {club.archived ? 'Restore' : 'Archive'}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            {club ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!club} />
        </label>
        <label className="field">
          <span>Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Faculty advisor</span>
          <input className="input" value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="Ms. Smith" />
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="field">
        <span>Regular meetings</span>
        <MeetingsEditor value={meetings} onChange={setMeetings} />
      </div>
      <label className="check">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        <span>
          <strong>Private membership</strong>
          <div className="tiny muted">
            Only leaders, the advisor and administrators can see who belongs. Use for clubs where membership itself is
            sensitive.
          </div>
        </span>
      </label>
      <label className="field">
        <span>
          {club ? 'Add a leader' : 'First leader'} <span className="hint">(optional, verified immediately)</span>
        </span>
        <select className="input" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
          <option value="">None</option>
          {students.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} (grade {u.grade})
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}
