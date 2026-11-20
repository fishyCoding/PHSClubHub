import { useState } from 'react';
import { useToast } from '../../components/ui';
import * as A from '../../data/actions';
import type { Club } from '../../data/types';

export function ClubInfoTab({ club }: { club: Club }) {
  const { run } = useToast();
  const [description, setDescription] = useState(club.description);
  const dirty = description !== club.description;
  return (
    <div className="two-col">
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Description</h3>
        <p className="muted small">Shown on the club page and in Explore. Say what you do and who should join.</p>
        <textarea
          className="input"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={600}
        />
        <div className="row-between">
          <span className="tiny muted">{description.length}/600</span>
          <button
            className="btn btn-primary"
            disabled={!dirty}
            onClick={() => run(() => A.updateClubBasics(club.id, { description, meetings: club.meetings }), 'Description saved')}
          >
            Save
          </button>
        </div>
      </div>
      <div className="card stack small">
        <h3 style={{ margin: 0 }}>Managed by administrators</h3>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{club.name}</dd>
          <dt>Category</dt>
          <dd>{club.category}</dd>
          <dt>Advisor</dt>
          <dd>{club.advisor}</dd>
          <dt>Membership</dt>
          <dd>{club.hiddenMembership ? 'Private' : 'Visible to members'}</dd>
        </dl>
        <p className="muted">To change these, contact the Activities Office or Tech Office.</p>
      </div>
    </div>
  );
}
