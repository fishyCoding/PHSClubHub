import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Club, User } from '../data/types';

// ---------------------------------------------------------------- toasts

interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

const ToastCtx = createContext<{
  toast: (text: string) => void;
  error: (text: string) => void;
  /** Run an action; show `success` on success or the error message on failure. */
  run: (fn: () => void, success?: string) => boolean;
}>({ toast: () => {}, error: () => {}, run: () => false });

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, error = false) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), error ? 4500 : 2600);
  }, []);
  const toast = useCallback((t: string) => push(t), [push]);
  const error = useCallback((t: string) => push(t, true), [push]);
  const run = useCallback(
    (fn: () => void, success?: string) => {
      try {
        fn();
        if (success) push(success);
        return true;
      } catch (e) {
        push(e instanceof Error ? e.message : 'Something went wrong.', true);
        return false;
      }
    },
    [push],
  );
  return (
    <ToastCtx.Provider value={{ toast, error, run }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ---------------------------------------------------------------- modal

export function Modal({
  title,
  onClose,
  children,
  actions,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

/** A button that asks "are you sure?" in a modal before running. */
export function ConfirmButton({
  label,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  className = 'btn btn-sm',
}: {
  label: ReactNode;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <Modal
          title={title}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </button>
            </>
          }
        >
          <div className="muted">{message}</div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- small pieces

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          className={t.id === value ? 'on' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {!!t.count && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={o.id === value ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, '')
    .split(/[\s&]+/)
    .filter((p) => p && !/^(the|of|and)$/i.test(p))
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ user, size }: { user: Pick<User, 'id' | 'name'>; size?: 'lg' }) {
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} aria-hidden="true">
      {initials(user.name)}
    </span>
  );
}

export function ClubIcon({ club, size }: { club: Pick<Club, 'name'>; size?: 'lg' }) {
  return (
    <span className={`club-icon${size ? ' ' + size : ''}`} aria-hidden="true">
      {initials(club.name)}
    </span>
  );
}

export function Meter({ value, tone }: { value: number; tone?: 'ok' | 'warn' | 'danger' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`meter${tone ? ' ' + tone : ''}`} aria-label={`${Math.round(pct)}%`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return <span className="muted tiny">no data</span>;
  return (
    <span className="spark" aria-hidden="true">
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(8, v * 100)}%` }} />
      ))}
    </span>
  );
}

export function rateTone(rate: number): 'ok' | 'warn' | 'danger' {
  return rate >= 0.7 ? 'ok' : rate >= 0.5 ? 'warn' : 'danger';
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// ---------------------------------------------------------------- icons

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  calendar: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  check: 'M4 12.5l5 5L20 6.5',
  megaphone: 'M3 10v4h4l7 4V6L7 10zM18 9a4 4 0 0 1 0 6',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  userPlus: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M19 8v6M16 11h6',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
