import { Link } from 'react-router-dom';
import { useMe } from '../../components/Layout';
import { Avatar, ClubIcon, pct } from '../../components/ui';
import { timeAgo } from '../../data/dates';
import { attendanceStats, clubById, userById } from '../../data/selectors';
import { useDB } from '../../data/store';

export function AdminDashboard() {
  const db = useDB();
  const me = useMe();
  const clubs = db.clubs.filter((c) => !c.archived);
  const students = db.users.filter((u) => u.role === 'student');
  const involved = new Set(db.memberships.filter((m) => m.status === 'active').map((m) => m.userId));
  const leaderReqs = db.leaderRequests.filter((r) => r.status === 'pending');
  const reports = db.reports.filter((r) => r.status === 'open');
  const stats = clubs.map((c) => attendanceStats(db, c.id));
  const inactive = stats.filter((s) => s.sessionsLast30 === 0);
  const avgRate = stats.filter((s) => s.sessions).reduce((a, s, _, arr) => a + s.avgRate / arr.length, 0);
  const pendingJoins = db.memberships.filter((m) => m.status === 'pending').length;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p>
            Signed in as {me.name} ({me.title})
          </p>
        </div>
        <Link to="/admin/clubs?new=1" className="btn btn-primary">
          + Create club
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">Active clubs</div>
          <div className="value">{clubs.length}</div>
          <div className="sub">{db.clubs.length - clubs.length} archived</div>
        </div>
        <div className="stat">
          <div className="label">Students in a club</div>
          <div className="value">{involved.size}</div>
          <div className="sub">of {students.length} with accounts</div>
        </div>
        <div className="stat">
          <div className="label">Avg. attendance</div>
          <div className="value">{pct(avgRate)}</div>
          <div className="sub">across clubs with records</div>
        </div>
        <div className="stat">
          <div className="label">Pending join requests</div>
          <div className="value">{pendingJoins}</div>
          <div className="sub">handled by club leaders</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card card-flush">
          <div className="card-section row-between">
            <h3 style={{ margin: 0 }}>Leader verification</h3>
            <Link to="/admin/leaders" className="small">
              Open
            </Link>
          </div>
          {leaderReqs.length === 0 ? (
            <div className="card-section muted small">No requests waiting.</div>
          ) : (
            leaderReqs.slice(0, 4).map((r) => {
              const u = userById(db, r.userId)!;
              return (
                <div key={r.id} className="list-item">
                  <Avatar user={u} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong">{u.name}</div>
                    <div className="tiny muted">
                      {r.position}, {clubById(db, r.clubId)?.name}
                    </div>
                  </div>
                  <span className="tiny muted">{timeAgo(r.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="card card-flush">
          <div className="card-section row-between">
            <h3 style={{ margin: 0 }}>Reported posts</h3>
            <Link to="/admin/moderation" className="small">
              Open
            </Link>
          </div>
          {reports.length === 0 ? (
            <div className="card-section muted small">Nothing to review.</div>
          ) : (
            reports.slice(0, 4).map((r) => {
              const p = db.posts.find((x) => x.id === r.postId);
              return (
                <div key={r.id} className="list-item">
                  <span className="badge danger">Report</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong">{p?.title ?? 'Deleted post'}</div>
                    <div className="tiny muted">{r.reason}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card card-flush">
          <div className="card-section row-between">
            <h3 style={{ margin: 0 }}>Clubs needing attention</h3>
            <Link to="/admin/attendance" className="small">
              Attendance
            </Link>
          </div>
          {inactive.length === 0 ? (
            <div className="card-section muted small">Every club recorded a meeting in the last 30 days.</div>
          ) : (
            inactive.map((s) => {
              const c = clubById(db, s.clubId)!;
              return (
                <div key={c.id} className="list-item">
                  <ClubIcon club={c} />
                  <div style={{ flex: 1 }}>
                    <div className="small strong">{c.name}</div>
                    <div className="tiny muted">
                      No attendance in 30 days{s.lastSession ? ` · last ${s.lastSession}` : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card card-flush">
        <div className="card-section">
          <h3 style={{ margin: 0 }}>Recent admin & leader activity</h3>
        </div>
        {db.audit.length === 0 ? (
          <div className="card-section muted small">No activity logged yet in this demo session.</div>
        ) : (
          db.audit.slice(0, 12).map((a) => (
            <div key={a.id} className="list-item small">
              <span className="strong">{userById(db, a.actorId)?.name}</span>
              <span>{a.action.toLowerCase()}</span>
              <span className="muted" style={{ flex: 1, minWidth: 0 }}>
                {a.detail}
              </span>
              <span className="tiny muted nowrap">{timeAgo(a.at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
