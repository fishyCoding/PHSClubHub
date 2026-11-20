import { Link } from 'react-router-dom';
import { describeMeeting } from '../data/dates';
import { useDB } from '../data/store';
import { activeMembers, followerCount } from '../data/selectors';
import * as P from '../data/permissions';
import type { Club, ID } from '../data/types';
import { ClubIcon } from './ui';

export function RelationBadge({ clubId, userId }: { clubId: ID; userId: ID }) {
  const db = useDB();
  const m = P.membershipOf(db, userId, clubId);
  if (m?.status === 'active' && m.role === 'leader') return <span className="badge accent">Leader</span>;
  if (m?.status === 'active') return <span className="badge ok">Member</span>;
  if (m?.status === 'pending') return <span className="badge warn">Request pending</span>;
  if (P.isFollowing(db, userId, clubId)) return <span className="badge info">Following</span>;
  return null;
}

export function ClubCard({ club, userId }: { club: Club; userId: ID }) {
  const db = useDB();
  return (
    <Link to={`/clubs/${club.id}`} className="card club-card">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <ClubIcon club={club} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ marginBottom: 2 }}>{club.name}</h3>
          <div className="row">
            <span className="badge">{club.category}</span>
            <RelationBadge clubId={club.id} userId={userId} />
          </div>
        </div>
      </div>
      <p className="desc">{club.description}</p>
      <div className="stack" style={{ gap: 2 }}>
        {club.meetings.map((m, i) => (
          <div className="meeting-line" key={i}>
            <span>
              <strong>{describeMeeting(m)}</strong> <span className="muted">· {m.room}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="muted tiny">
        {club.hiddenMembership ? 'Private membership' : `${activeMembers(db, club.id).length} members`} ·{' '}
        {followerCount(db, club.id)} followers
      </div>
    </Link>
  );
}
