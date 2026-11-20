import { SLOTS, WEEKDAYS, type MeetingTime, type Slot, type Weekday } from '../data/types';

/** Edit a list of regular meeting times ("Tuesday lunch in Room 204"). */
export function MeetingsEditor({
  value,
  onChange,
}: {
  value: MeetingTime[];
  onChange: (next: MeetingTime[]) => void;
}) {
  const set = (i: number, patch: Partial<MeetingTime>) =>
    onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.map((m, i) => (
        <div key={i} className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ width: 140 }}>
            <span>Day</span>
            <select className="input" value={m.day} onChange={(e) => set(i, { day: e.target.value as Weekday })}>
              {WEEKDAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ width: 150 }}>
            <span>Time</span>
            <select className="input" value={m.slot} onChange={(e) => set(i, { slot: e.target.value as Slot })}>
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span>Room</span>
            <input className="input" value={m.room} onChange={(e) => set(i, { room: e.target.value })} placeholder="Room 204" />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span>
              Note <span className="hint">(optional)</span>
            </span>
            <input
              className="input"
              value={m.note ?? ''}
              onChange={(e) => set(i, { note: e.target.value })}
              placeholder="every other week"
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-danger btn-sm"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label="Remove meeting"
            style={{ marginBottom: 4 }}
          >
            ✕
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() =>
            onChange([...value, { day: 'Monday', slot: 'lunch', room: value[value.length - 1]?.room ?? '' }])
          }
        >
          + Add meeting time
        </button>
      </div>
    </div>
  );
}
