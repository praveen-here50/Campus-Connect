import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  FolderKanban,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth, useMe } from '../lib/auth'
import { connectSocket, disconnectSocket, useSubscription } from '../lib/socket'
import { getTheme, toggleTheme } from '../lib/theme'
import type { Notification } from '../lib/types'
import { useToast } from './Toasts'
import { Avatar, Logo } from './ui'

const NAV = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/people', label: 'People', icon: Users },
  { to: '/knowledge', label: 'Knowledge hub', icon: BookOpen },
  { to: '/assistant', label: 'Assistant', icon: MessageCircleQuestion },
]

/** A full-width labelled row, or in the rail a 32px icon with the label as tooltip and accessible name. */
function NavItem({ to, label, icon: Icon, end, count, rail }: { to: string; label: string; icon: typeof Users; end?: boolean; count?: number; rail?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={rail ? label : undefined}
      className={({ isActive }) =>
        `${rail ? 'relative w-8 justify-center' : 'gap-2.5 px-2.5'} flex h-8 items-center rounded-lg transition-colors ${
          isActive ? 'bg-active text-ink' : 'text-muted hover:text-ink'
        }`
      }
    >
      <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
      <span className={rail ? 'sr-only' : 'flex-1'}>{label}</span>
      {!!count &&
        (rail ? (
          <span className="num absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-medium text-on-primary">
            {count}
          </span>
        ) : (
          <span className="num text-[12px] font-medium text-ink">{count}</span>
        ))}
    </NavLink>
  )
}

const iconButton = 'flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted hover:text-ink'
const rowButton = 'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-muted hover:text-ink'

function Sidebar({ rail = false, action, onNavigate }: { rail?: boolean; action?: ReactNode; onNavigate?: () => void }) {
  const me = useMe()
  const { logout } = useAuth()
  const [theme, setThemeState] = useState(getTheme)
  const unread = useQuery({
    queryKey: ['unread'],
    queryFn: () => api.get<{ count: number }>('/api/notifications/unread-count'),
    refetchInterval: 60_000,
  })
  const themeLabel = theme === 'dark' ? 'Light theme' : 'Dark theme'
  return (
    <div
      className={`flex h-full flex-col gap-6 px-3 py-5 ${rail ? 'items-center' : ''}`}
      onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}
    >
      <div className={rail ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between pl-2.5'}>
        <Logo withName={!rail} />
        {action}
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavItem key={n.to} {...n} rail={rail} />
        ))}
      </nav>
      <div className="flex flex-col gap-0.5">
        {rail ? (
          <span className="mx-auto mb-1 h-px w-6 bg-rule" aria-hidden="true" />
        ) : (
          <p className="mb-1 px-2.5 text-[12px] text-muted">For you</p>
        )}
        <NavItem to="/inbox" label="Inbox" icon={Inbox} count={unread.data?.count} rail={rail} />
      </div>
      <div className={`mt-auto flex flex-col gap-1 ${rail ? 'items-center' : ''}`}>
        <button type="button" className={rail ? iconButton : rowButton} title={rail ? themeLabel : undefined} onClick={() => setThemeState(toggleTheme())}>
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.6} aria-hidden="true" /> : <Moon size={16} strokeWidth={1.6} aria-hidden="true" />}
          <span className={rail ? 'sr-only' : undefined}>{themeLabel}</span>
        </button>
        <NavLink
          to="/profile"
          title={rail ? 'Your profile' : undefined}
          className={({ isActive }) => `flex items-center rounded-lg ${rail ? 'justify-center p-1' : 'gap-2.5 px-2.5 py-2'} ${isActive ? 'bg-active' : ''}`}
        >
          <Avatar id={me.id} name={me.fullName} size={28} />
          {rail ? (
            <span className="sr-only">Your profile</span>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{me.fullName}</span>
              <span className="block truncate text-[12px] text-muted">Your profile</span>
            </span>
          )}
        </NavLink>
        <button type="button" className={rail ? iconButton : rowButton} title={rail ? 'Sign out' : undefined} onClick={logout}>
          <LogOut size={16} strokeWidth={1.6} aria-hidden="true" />
          <span className={rail ? 'sr-only' : undefined}>Sign out</span>
        </button>
      </div>
    </div>
  )
}

function screenName(path: string): string {
  if (path === '/') return 'Home'
  const hit = [...NAV, { to: '/inbox', label: 'Inbox' }, { to: '/profile', label: 'Profile' }].find(
    (n) => n.to !== '/' && path.startsWith(n.to),
  )
  return hit?.label ?? 'CampusConnect'
}

/** Live notifications: refresh counts and lists, and show a toast. */
function LiveUpdates() {
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  useEffect(() => {
    connectSocket()
    return () => disconnectSocket()
  }, [me.id])
  useSubscription<Notification>('/user/queue/notifications', (n) => {
    toast(n.message, n.link)
    for (const key of ['unread', 'notifications', 'dashboard', 'myApplications', 'connections']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  })
  return null
}

// Desktop sidebar: labelled, or folded to an icon rail; the choice is remembered on this device.
const RAIL_KEY = 'cc.sidebar'

function storedRail(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === 'rail'
  } catch {
    return false
  }
}

export function Shell({ children }: { children?: ReactNode }) {
  const location = useLocation()
  // The drawer remembers the path it was opened on, so navigating closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === location.pathname
  const setMenuOpen = (open: boolean) => setMenuPath(open ? location.pathname : null)
  const [rail, setRail] = useState(storedRail)
  const toggleRail = () => {
    const next = !rail
    setRail(next)
    try {
      localStorage.setItem(RAIL_KEY, next ? 'rail' : 'full')
    } catch {
      // not remembered, still applied
    }
  }

  // While the phone menu is open: Escape closes it and the page behind does not scroll.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuPath(null)
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const railLabel = rail ? 'Expand sidebar' : 'Collapse sidebar'
  return (
    <div
      className={`min-h-svh lg:grid lg:transition-[grid-template-columns] lg:duration-200 ${rail ? 'lg:grid-cols-[56px_1fr]' : 'lg:grid-cols-[240px_1fr]'}`}
    >
      <LiveUpdates />
      <aside id="sidebar" className="sticky top-0 hidden h-svh overflow-hidden border-r border-rule lg:block">
        <Sidebar
          rail={rail}
          action={
            <button
              type="button"
              className={iconButton}
              aria-label={railLabel}
              aria-controls="sidebar"
              aria-expanded={!rail}
              title={railLabel}
              onClick={toggleRail}
            >
              {rail ? <PanelLeftOpen size={16} strokeWidth={1.6} /> : <PanelLeftClose size={16} strokeWidth={1.6} />}
            </button>
          }
        />
      </aside>

      {/* Phone and tablet: a 48px bar with the screen's name and a drawer from the left. */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-rule bg-ground px-4 lg:hidden">
        <span className="flex items-center gap-2.5">
          <Logo withName={false} />
          <span className="font-semibold">{screenName(location.pathname)}</span>
        </span>
        <button type="button" className="btn btn-secondary btn-sm w-9 px-0" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Menu size={18} />
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer-scrim absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => setMenuOpen(false)} />
          <div className="drawer-panel absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-rule bg-ground">
            <Sidebar
              onNavigate={() => setMenuOpen(false)}
              action={
                <button type="button" className={iconButton} aria-label="Close menu" autoFocus onClick={() => setMenuOpen(false)}>
                  <X size={18} />
                </button>
              }
            />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-[1360px]">{children ?? <Outlet />}</div>
      </main>
    </div>
  )
}
