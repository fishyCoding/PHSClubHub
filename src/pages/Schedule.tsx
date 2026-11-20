import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { Empty, Segmented } from '../components/ui';
import { addDays, formatDate, todayISO } from '../data/dates';
import { clubById, myClubIds, scheduleFor, thisWeekStart } from '../data/selectors';
import { useDB } from '../data/store';
import { WEEKDAYS } from '../data/types';

type Show = 'all' | 'member';

export function Schedule() {
  const db = useDB();
  const me = useMe();
  const [weekStart, setWeekStart] = useState(thisWeekStart());
  const [show, setShow] = useState<Show>('all');
  const today = todayISO();
  const items = scheduleFor(db, me.id, weekStart, 5).filter((s) => show === 'all' || s.relation === 'member');
  const mine = myClubIds(db, me.id);
  const isThisWeek = weekStart === thisWeekStart();

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Schedule</h1>
          <p>
            Week of {formatDate(weekStart, { weekday: undefined, month: 'long' })}
            {isThisWeek && ' (this week)'}
          </p>
        </div>
        <div className="row">
          <Segmented<Show>
            value={show}
            onChange={setShow}
            options={[
              { id: 'all', label: 'Joined + followed' },
              { id: 'member', label: 'Joined only' },
            ]}
          />
          <div className="row" style={{ gap: 4 }}>
            <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
              ←
            </button>
            <button className="btn btn-sm" onClick={() => setWeekStart(thisWeekStart())} disabled={isThisWeek}>
              Today
            </button>
            <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
              →
            </button>
          </div>
        </div>
      </div>

      {mine.joined.length + mine.following.length === 0 ? (
        <div className="card">
          <Empty title="Your schedule is empty">
            Join or follow clubs and their meetings show up here. <Link to="/explore">Explore clubs</Link>
          </Empty>
        </div>
      ) : (
        <>
          <div className="week">
            {WEEKDAYS.map((wd, i) => {
              const date = addDays(weekStart, i);
              const dayItems = items.filter((s) => s.date === date);
              return (
                <div key={wd} className={`day${date === today ? ' today' : ''}`}>
                  <div className="day-head">
                    <span>{wd}</span>
                    <span className="muted tiny">{formatDate(date, { weekday: undefined })}</span>
                  </div>
                  {dayItems.length === 0 && <span className="muted tiny">No meetings</span>}
                  {dayItems.map((s, j) => {
                    const club = clubById(db, s.clubId)!;
                    return (
                      <Link
                        key={j}
                        to={`/clubs/${club.id}`}
                        className={`slot ${s.relation === 'following' ? 'following' : ''} ${s.status}`}
                      >
                        <span className="slot-label">{s.slot}</span>
                        <span className="strong">{club.name}</span>
                        <span className="muted">{s.room}</span>
                        {s.status === 'cancelled' && <span className="badge danger">Cancelled</span>}
                        {s.status === 'moved' && <span className="badge warn">Room change</span>}
                        {s.status === 'extra' && <span className="badge info">{s.title}</span>}
                        {s.note && <span className="tiny muted">{s.note}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="row small muted">
            <span className="badge" style={{ borderLeft: '3px solid var(--accent)' }}>Joined</span>
            <span className="badge" style={{ borderLeft: '3px solid var(--muted)' }}>Following</span>
            <span className="badge danger">Cancelled</span>
            <span className="badge warn">Room change</span>
            <span className="badge info">Extra event</span>
          </div>
        </>
      )}
    </div>
  );
}
