import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { API_URL, errorMessage } from '../lib/api'
import { useAvatarVersions } from '../lib/avatars'
import { initials, personHue, STATUS_LABEL } from '../lib/format'

/** The middle dot between facts in a meta line, with real room on both sides. */
export function Sep() {
  return (
    <span aria-hidden="true" className="mx-[0.45em] inline-block">
      ·
    </span>
  )
}

/** The product mark: two linked rings, one in the accent. */
export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="12" cy="16" r="8" fill="none" stroke="var(--accent)" strokeWidth="3.5" />
        <circle cx="20" cy="16" r="8" fill="none" stroke="var(--text)" strokeWidth="3.5" />
      </svg>
      {withName && <span className="text-[15px] font-semibold tracking-tight">CampusConnect</span>}
    </span>
  )
}

export function Avatar({ id, name, size = 32 }: { id: number; name: string; size?: number }) {
  const version = useAvatarVersions().data?.[id]
  if (version) {
    return (
      <img
        src={`${API_URL}/api/users/${id}/avatar?v=${version}`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="flex-none rounded-full bg-active object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="avatar inline-flex flex-none items-center justify-center rounded-full font-medium select-none"
      style={{ ['--h' as string]: personHue(id), width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

/** Name with avatar, linking to the profile. */
export function Person({ id, name, sub, size = 32 }: { id: number; name: string; sub?: ReactNode; size?: number }) {
  return (
    <Link to={`/users/${id}`} className="flex min-w-0 items-center gap-3">
      <Avatar id={id} name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
      </span>
    </Link>
  )
}

/**
 * The seat strip: a team as its seats. Taken seats show the member, open seats are dashed
 * rings in the accent, because an open seat is what a student is looking for.
 */
export function SeatStrip({ members, max, size = 26 }: { members: { id: number; name: string }[]; max: number; size?: number }) {
  const open = Math.max(0, max - members.length)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex items-center gap-1" aria-hidden="true">
        {members.map((m) => (
          <Avatar key={m.id} id={m.id} name={m.name} size={size} />
        ))}
        {Array.from({ length: open }, (_, i) => (
          <span
            key={`open-${i}`}
            className="flex-none rounded-full border-[1.5px] border-dashed border-accent"
            style={{ width: size, height: size }}
          />
        ))}
      </span>
      <span className="num text-[13px] text-muted">
        {open === 0 ? 'Team full' : `${open} of ${max} seats open`}
      </span>
    </span>
  )
}

/** Seat strip for list rows where only counts are known. */
export function SeatCount({ taken, max }: { taken: number; max: number }) {
  const open = Math.max(0, max - taken)
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${taken} of ${max} seats taken`}>
      <span className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={
              i < taken
                ? 'h-2.5 w-2.5 rounded-full bg-ink'
                : 'h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-accent'
            }
          />
        ))}
      </span>
      <span className="num text-[13px] text-muted">{open === 0 ? 'Full' : `${open} open`}</span>
    </span>
  )
}

export function SkillChips({ skills, have, limit }: { skills: string[]; have?: Set<string>; limit?: number }) {
  const shown = limit ? skills.slice(0, limit) : skills
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <span key={s} className={have?.has(s) ? 'pill pill-accent' : 'pill'}>
          {s}
        </span>
      ))}
      {limit && skills.length > limit && <span className="pill">+{skills.length - limit}</span>}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'OPEN' || status === 'ACCEPTED'
      ? 'pill pill-positive'
      : status === 'REJECTED'
        ? 'pill pill-negative'
        : status === 'PENDING'
          ? 'pill pill-warning'
          : 'pill'
  return <span className={tone}>{STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}</span>
}

export function PageTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl leading-8 font-semibold tracking-[-0.01em]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  count,
  action,
  children,
  className = '',
}: {
  title: ReactNode
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {title}
          {count !== undefined && <span className="pill num">{count}</span>}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/** An empty block keeps its frame and says one sentence, with the next step if there is one. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dashed border-control px-4 py-3 text-muted">
      <span>{children}</span>
      {action}
    </div>
  )
}

export function ErrorRow({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[var(--pill-negative-bg)] px-4 py-3 text-[var(--pill-negative-ink)]">
      <span>{errorMessage(error)}</span>
      {retry && (
        <button type="button" className="btn-text font-medium" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function SkeletonRows({ rows = 3, height = 63 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  )
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[22px] bg-raised p-0 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop:bg-black/40"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" className="btn btn-secondary btn-sm w-8 px-0" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="mt-3 text-[var(--negative)]">
      {errorMessage(error)}
    </p>
  )
}
