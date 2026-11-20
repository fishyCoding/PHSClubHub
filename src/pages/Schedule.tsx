import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../components/Layout';
import { RsvpButtons, RsvpCount } from '../components/Rsvp';
import { clubColor, Empty, Segmented } from '../components/ui';
import { addDays, formatDate, slotLabel, todayISO } from '../data/dates';
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
                <div key={wd} className={`day${date === today ? ' today' : ''}${date < today ? ' past' : ''}`}>
                  <div className="day-head">
                    <span>{wd}</span>
                    <span className="muted tiny">{date === today ? 'Today' : formatDate(date, { weekday: undefined })}</span>
                  </div>
                  {dayItems.length === 0 && <span className="muted tiny">No meetings</span>}
                  {dayItems.map((s, j) => {
                    const club = clubById(db, s.clubId)!;
                    return (
                      <div
                        key={j}
                        className={`slot ${s.relation === 'following' ? 'following' : ''} ${s.status}`}
                        style={{ borderLeftColor: clubColor(club) }}
                      >
                        <span className="slot-label">{slotLabel(s.slot)}</span>
                        <Link to={`/clubs/${club.id}`} className="strong text">
                          {club.name}
                        </Link>
                        <span className="muted">{s.room}</span>
                        {s.status === 'cancelled' && <span className="badge danger">Cancelled</span>}
                        {s.status === 'moved' && <span className="badge warn">Room changed</span>}
                        {s.status === 'extra' && <span className="badge info">Extra · {s.title}</span>}
                        {s.relation === 'following' && <span className="tiny muted">Following</span>}
                        {s.note && <span className="tiny muted">{s.note}</span>}
                        <RsvpCount clubId={s.clubId} date={s.date} slot={s.slot} />
                        <div style={{ marginTop: 4 }}>
                          <RsvpButtons
                            clubId={s.clubId}
                            date={s.date}
                            slot={s.slot}
                            cancelled={s.status === 'cancelled'}
                            compact
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="schedule-legend">
            <span>Each card is coloured by club.</span>
            <span>
              <span className="legend-swatch faded" /> Faded = clubs you follow
            </span>
            <span>
              <span className="badge danger">Cancelled</span>
            </span>
            <span>
              <span className="badge warn">Room changed</span>
            </span>
            <span>
              <span className="badge info">Extra meeting</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
