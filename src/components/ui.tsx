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
