import { useState } from 'react';
import { Avatar, useToast } from '../components/ui';
import * as A from '../data/actions';
import * as P from '../data/permissions';
import { useDB } from '../data/store';
import type { User } from '../data/types';

const FEATURED: { id: string; blurb: string }[] = [
  { id: 'u-priya', blurb: 'Student: member of 3 clubs, follows a few more, has a pending join request' },
  { id: 'u-sam', blurb: 'Freshman: just getting started, has a leader request waiting' },
  { id: 'u-maya', blurb: 'Leads Robotics (with pending join requests), member of Debate & Coding' },
  { id: 'u-jordan', blurb: 'Leads Debate Society' },
  { id: 'u-aisha', blurb: 'Leads the GSA (private membership)' },
  { id: 'u-admin', blurb: 'Tech Office administrator' },
];

export function Login() {
  const db = useDB();
  const { run } = useToast();
  const [email, setEmail] = useState('');

  const signInEmail = () => {
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    run(() => {
      if (!u) throw new Error('No account with that email in the demo data.');
      A.signIn(u.id);
    });
  };

  const others = db.users.filter((u) => !FEATURED.some((f) => f.id === u.id));

  const roleLabel = (u: User) =>
    u.role === 'admin'
      ? `Admin · ${u.title}`
      : P.leadsAnyClub(db, u.id)
        ? `Grade ${u.grade} · Leader`
        : `Grade ${u.grade}`;

  return (
    <div className="login">
      <div className="login-card stack-lg">
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="brand-mark" style={{ width: 52, height: 52, fontSize: '1.1rem', borderRadius: 14 }}>
            PHS
          </span>
          <h1>Club Hub</h1>
          <p className="muted">
            Every Princeton High School club in one place: updates, meeting times, rooms and attendance.
          </p>
        </div>

        <div className="card stack">
          <h2>Sign in</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              signInEmail();
            }}
          >
            <input
              className="input"
              style={{ flex: 1, minWidth: 220 }}
              type="email"
              placeholder="School email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
              Continue
            </button>
          </form>
          <p className="muted tiny">
            Prototype: school sign-in will replace this when the backend is connected. For now, pick a demo account below.
          </p>
        </div>

        <div className="stack">
          <h3>Demo accounts</h3>
          <div className="persona-grid">
            {FEATURED.map((f) => {
              const u = db.users.find((x) => x.id === f.id);
              if (!u) return null;
              return (
                <button key={u.id} className="persona" onClick={() => run(() => A.signIn(u.id))}>
                  <Avatar user={u} size="lg" />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{u.name}</div>
                    <div className="tiny muted">{f.blurb}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <details>
            <summary className="muted small" style={{ cursor: 'pointer' }}>
              All {others.length} other accounts
            </summary>
            <div className="persona-grid" style={{ marginTop: 10 }}>
              {others.map((u) => (
                <button key={u.id} className="persona" onClick={() => run(() => A.signIn(u.id))}>
                  <Avatar user={u} />
                  <div>
                    <div className="strong small">{u.name}</div>
                    <div className="tiny muted">{roleLabel(u)}</div>
                  </div>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
