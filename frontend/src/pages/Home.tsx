import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorRow, Panel, SeatCount, Sep, SkeletonRows, SkillChips } from '../components/ui'
import { api } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, greetingWord, plural, STATUS_LABEL } from '../lib/format'
import type { Count, Dashboard } from '../lib/types'

/** Today's one fact, from the student's own data, for the line under the greeting. */
function finding(d: Dashboard): { text: string; link?: string; action?: string } {
  const s = d.stats
  if (s.pendingRequests > 0)
    return { text: `${plural(s.pendingRequests, 'request')} ${s.pendingRequests === 1 ? 'is' : 'are'} waiting on your answer.`, link: '/inbox', action: 'Answer now' }
  const next = d.myTasks[0]
  if (next) return { text: `Next on your board: “${next.title}” for ${next.projectTitle}.`, link: `/projects/${next.projectId}/workspace`, action: 'Open board' }
  const top = d.recommended[0]
  if (top && top.score >= 40)
    return { text: `${top.project.title} has an open seat that fits your skills.`, link: `/projects/${top.project.id}`, action: 'Take a look' }
  return { text: 'Add your skills so CampusConnect can match you to teams.', link: '/profile', action: 'Add skills' }
}

const ROWS = 5

/** A count that opens its list. `due` marks the one that waits on the student, in the accent. */
function Tile({ label, value, caption, to, due }: { label: string; value: number; caption: string; to: string; due?: boolean }) {
  return (
    <Link to={to} className="panel flex h-[140px] flex-col justify-between !p-5 transition-colors hover:border-control">
      <span className="font-medium">{label}</span>
      <span className={`num text-[40px] leading-none tracking-[-0.02em] ${due ? 'text-accent' : ''}`}>{value.toLocaleString('en')}</span>
      <span className="truncate text-[13px] text-muted">{caption}</span>
    </Link>
  )
}

// Task states in one hue: finished work in the full accent, work under way at half, the rest in grey.
const PROGRESS = [
  { key: 'DONE', label: 'Done', fill: 'bg-accent' },
  { key: 'IN_PROGRESS', label: 'Building', fill: 'bg-accent/45' },
  { key: 'TODO', label: 'To do', fill: 'bg-control' },
]

/** Where the work on the student's teams stands: one proportional bar, then the counts it is made of. */
function TeamProgress({ counts }: { counts: Count[] }) {
  const by: Record<string, number> = Object.fromEntries(counts.map((c) => [c.label, c.count]))
  const total = PROGRESS.reduce((n, p) => n + (by[p.key] ?? 0), 0)
  if (!total) return null
  const done = by.DONE ?? 0
  return (
    <div className="mt-auto border-t border-rule pt-4">
      <p className="mb-2.5 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">Across your teams</span>
        <span className="num text-muted">
          {done} of {total} done
        </span>
      </p>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={PROGRESS.map((p) => `${by[p.key] ?? 0} ${p.label.toLowerCase()}`).join(', ')}>
        {PROGRESS.map((p) => (by[p.key] ? <span key={p.key} className={p.fill} style={{ flexGrow: by[p.key] }} /> : null))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {PROGRESS.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${p.fill}`} aria-hidden="true" />
            {p.label}
            <span className="num font-medium">{by[p.key] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A ranked list where the row is the bar, in the accent's pale tint: a count of people, so data. */
function BarList({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  const max = Math.max(...rows.map((r) => r.count))
  return (
    <ol className="flex flex-col gap-[2px]">
      {rows.map((r) => (
        <li key={r.label} className="relative flex h-[52px] items-center justify-between px-3">
          <span className="absolute inset-y-0 left-0 rounded-lg bg-accent-tint" style={{ width: `${(r.count / max) * 88}%` }} aria-hidden="true" />
          <span className="relative">{r.label}</span>
          <span className="num relative">{r.count.toLocaleString('en')}</span>
        </li>
      ))}
    </ol>
  )
}

export function Home() {
  const me = useMe()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/api/dashboard') })
  const first = me.fullName.split(' ')[0]
  const [today] = useState(() => new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }))
  const d = q.data
  const f = d ? finding(d) : null
  const mySkills = new Set(Object.keys(me.skills))

  return (
    <div className="lg:pt-6">
      <header>
        <h1 className="font-serif text-[34px] leading-[1.05] tracking-[-0.01em] sm:text-[48px]">
          {greetingWord()}, {first}.
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          {today}
          {d && (
            <>
              <Sep />
              {plural(d.platform.students, 'student')} on CampusConnect
              <Sep />
              {plural(d.platform.openProjects, 'project')} recruiting
            </>
          )}
        </p>
        <div className="mt-4 min-h-7 text-[17px]">
          {f ? (
            <p>
              {f.text}{' '}
              {f.link && (
                <Link to={f.link} className="btn-text font-medium">
                  {f.action}
                </Link>
              )}
            </p>
          ) : q.isLoading ? (
            <span className="skeleton h-6 w-80" />
          ) : null}
        </div>
      </header>

      {q.isError && (
        <div className="mt-8">
          <ErrorRow error={q.error} retry={() => q.refetch()} />
        </div>
      )}

      {/* 12-column grid: tiles 3/3/3/3, then 9 + 3, then 6 + 6, so every internal edge meets one above it. */}
      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-12">
        {d ? (
          <>
            <div className="lg:col-span-3">
              <Tile label="Waiting on you" value={d.stats.pendingRequests} caption={d.stats.pendingRequests ? 'Applications and invites' : 'Nothing to answer'} to="/inbox" due={d.stats.pendingRequests > 0} />
            </div>
            <div className="lg:col-span-3">
              <Tile label="Open tasks" value={d.stats.openTasks} caption={d.stats.openTasks ? 'Assigned to you' : 'Board is clear'} to="/projects?mine=1" />
            </div>
            <div className="lg:col-span-3">
              <Tile label="Teams" value={d.stats.projects} caption={d.stats.ownedProjects ? `${d.stats.ownedProjects} started by you` : 'Join or start one'} to="/projects?mine=1" />
            </div>
            <div className="lg:col-span-3">
              <Tile label="Connections" value={d.stats.connections} caption={d.stats.posts ? `${plural(d.stats.upvotesReceived, 'upvote')} on your posts` : 'People you work with'} to="/people?tab=network" />
            </div>
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <span key={i} className="skeleton h-[140px] lg:col-span-3" />)
        )}

        <div className="col-span-2 lg:col-span-9">
          <Panel
            title="Projects that fit you"
            className="h-full"
            action={
              <Link to="/projects?tab=for-you" className="btn-text">
                View all
              </Link>
            }
          >
            {!d ? (
              <SkeletonRows rows={3} />
            ) : d.recommended.length === 0 ? (
              <Empty action={<Link to="/projects/new" className="btn btn-primary btn-sm">Start a project</Link>}>
                No open project has a free seat right now.
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.recommended.map((m) => (
                  <li key={m.project.id}>
                    <Link to={`/projects/${m.project.id}`} className="row-card grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{m.project.title}</span>
                        <span className="block truncate text-[13px] text-muted">
                          {m.project.category}
                          <Sep />
                          by {m.project.ownerName}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="num block text-[20px] leading-6 text-accent">{m.score}%</span>
                        <span className="block text-[12px] text-muted">match</span>
                      </span>
                      <span className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                        <SkillChips skills={m.project.skills} have={mySkills} limit={5} />
                        <SeatCount taken={m.project.memberCount} max={m.project.maxMembers} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="col-span-2 lg:col-span-3">
          <Panel title="Your tasks" count={d?.stats.openTasks} className="flex h-full flex-col">
            {!d ? (
              <SkeletonRows rows={3} height={52} />
            ) : d.myTasks.length === 0 ? (
              <Empty>Nothing assigned to you.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.myTasks.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link to={`/projects/${t.projectId}/workspace`} className="row-card !py-2.5">
                      <span className="line-clamp-2 font-medium">{t.title}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {STATUS_LABEL[t.status]}
                        <Sep />
                        {t.projectTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {d && <TeamProgress counts={d.tasksByStatus} />}
            {/* The one thing pinned to a stretched card's foot is its action. */}
            <Link to="/projects?mine=1" className={`btn btn-secondary btn-sm w-full ${d?.tasksByStatus.length ? 'mt-4' : 'mt-auto'}`}>
              Open your boards
            </Link>
          </Panel>
        </div>

        {/* Third row: both lists show the same number of rows so the cards end level. */}
        <div className="col-span-2 lg:col-span-6">
          <Panel title="On your teams" className="h-full">
            {!d ? (
              <SkeletonRows rows={5} height={44} />
            ) : d.recentActivity.length === 0 ? (
              <Empty>Pushes, new members and finished tasks from your teams show up here.</Empty>
            ) : (
              <ul className="flex flex-col">
                {d.recentActivity.slice(0, ROWS).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 border-b border-rule py-2.5 last:border-0">
                    <span className="min-w-0">
                      <span className="line-clamp-2">{a.summary.startsWith(`${me.fullName} `) ? `You${a.summary.slice(me.fullName.length)}` : a.summary}</span>
                      <Link to={`/projects/${a.projectId}/workspace`} className="block truncate text-[13px] text-muted hover:text-ink">
                        {a.projectTitle}
                        {a.source === 'GITHUB' && (
                          <>
                            <Sep />
                            GitHub
                          </>
                        )}
                      </Link>
                    </span>
                    <span className="flex-none text-[13px] text-muted">{ago(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="col-span-2 lg:col-span-6">
          <Panel title="Skills on campus" className="h-full" action={<Link to="/people" className="btn-text">Find people</Link>}>
            {!d ? <SkeletonRows rows={5} height={40} /> : <BarList rows={d.topSkills.slice(0, Math.max(3, Math.min(ROWS, d.recentActivity.length)))} empty="No one has listed skills yet." />}
          </Panel>
        </div>
      </div>
    </div>
  )
}
