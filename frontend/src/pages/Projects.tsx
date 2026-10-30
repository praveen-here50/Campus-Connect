import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty, ErrorRow, PageTitle, SeatCount, SkeletonRows, SkillChips, StatusPill } from '../components/ui'
import { meta } from '../lib/meta'
import { api, qs } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, CATEGORIES, plural } from '../lib/format'
import type { ProjectMatch, ProjectSummary } from '../lib/types'

type Tab = 'all' | 'for-you' | 'mine'

function ProjectRow({ p, have, score }: { p: ProjectSummary; have: Set<string>; score?: number }) {
  return (
    <li className="md:col-span-3 md:grid md:grid-cols-subgrid">
      <Link to={`/projects/${p.id}`} className="row-card grid items-center gap-x-6 gap-y-2 md:col-span-3 md:grid-cols-subgrid">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{p.title}</span>
            <StatusPill status={p.status} />
          </span>
          <span className="block truncate text-[13px] text-muted">
            {meta([p.category, `by ${p.ownerName}`, ago(p.createdAt)])}
          </span>
        </span>
        <span className="min-w-0">{p.skills.length > 0 && <SkillChips skills={p.skills} have={have} limit={6} />}</span>
        <span className="flex items-center gap-4 md:justify-end">
          <SeatCount taken={p.memberCount} max={p.maxMembers} />
          {score !== undefined && <span className="num w-[86px] text-right text-accent">{score}% match</span>}
        </span>
      </Link>
    </li>
  )
}

export function Projects() {
  const me = useMe()
  const have = new Set(Object.keys(me.skills))
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('mine') ? 'mine' : ((params.get('tab') as Tab) ?? 'all')
  const [q, setQ] = useState(params.get('q') ?? '')
  const category = params.get('category') ?? ''
  const status = params.get('status') ?? 'OPEN'
  const skill = params.get('skill') ?? ''

  // Debounce typing into the URL so the search runs once per pause.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (q) next.set('q', q)
      else next.delete('q')
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [q, params, setParams])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const setTab = (t: Tab) => setParams(t === 'all' ? {} : t === 'mine' ? { mine: '1' } : { tab: t })

  const all = useQuery({
    queryKey: ['projects', params.get('q') ?? '', category, status, skill],
    queryFn: () => api.get<ProjectSummary[]>(`/api/projects${qs({ q: params.get('q'), category, status: status === 'ANY' ? '' : status, skill })}`),
    enabled: tab === 'all',
  })
  const forYou = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.get<ProjectMatch[]>('/api/ai/recommendations/projects?limit=20'),
    enabled: tab === 'for-you',
  })
  const mine = useQuery({
    queryKey: ['projects', 'mine'],
    queryFn: () => api.get<ProjectSummary[]>('/api/projects/mine'),
    enabled: tab === 'mine',
  })
  const active = tab === 'all' ? all : tab === 'mine' ? mine : forYou
  const count = active.data?.length

  return (
    <div>
      <PageTitle
        title="Projects"
        sub={count === undefined ? 'Teams looking for people, and the ones you are on.' : `${plural(count, 'project')} in this view`}
        actions={
          <Link to="/projects/new" className="btn btn-primary">
            <Plus size={16} /> Start a project
          </Link>
        }
      />

      <div className="tabs" role="tablist">
        {(
          [
            ['all', 'All projects'],
            ['for-you', 'Fits your skills'],
            ['mine', 'Your teams'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
            <span className="sr-only">Search projects</span>
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input className="field !h-9 !pl-9" placeholder="Search title or description" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Skill</span>
            <input className="field !h-9 w-[150px]" placeholder="Skill, e.g. react" defaultValue={skill} onBlur={(e) => setParam('skill', e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && setParam('skill', e.currentTarget.value.trim())} />
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select className="field !h-9 w-auto" value={category} onChange={(e) => setParam('category', e.target.value)}>
              <option value="">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select className="field !h-9 w-auto" value={status} onChange={(e) => setParam('status', e.target.value === 'OPEN' ? '' : e.target.value)}>
              <option value="OPEN">Recruiting</option>
              <option value="IN_PROGRESS">Building</option>
              <option value="COMPLETED">Shipped</option>
              <option value="ANY">Any status</option>
            </select>
          </label>
        </div>
      )}
      {tab === 'for-you' && (
        <p className="mt-4 text-muted">
          Ranked by how your profile reads against each project, and by the required skills you already have (shown in teal).
        </p>
      )}

      <div className="mt-4">
        {active.isLoading ? (
          <SkeletonRows rows={5} height={86} />
        ) : active.isError ? (
          <ErrorRow error={active.error} retry={() => active.refetch()} />
        ) : tab === 'for-you' ? (
          forYou.data!.length === 0 ? (
            <Empty action={<Link to="/profile" className="btn btn-secondary btn-sm">Edit skills</Link>}>
              No recruiting project has a free seat for you yet.
            </Empty>
          ) : (
            <ul className="grid gap-2 md:gap-x-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              {forYou.data!.map((m) => (
                <ProjectRow key={m.project.id} p={m.project} have={have} score={m.score} />
              ))}
            </ul>
          )
        ) : (active.data as ProjectSummary[]).length === 0 ? (
          <Empty action={<Link to="/projects/new" className="btn btn-primary btn-sm">Start a project</Link>}>
            {tab === 'mine' ? 'You are not on a team yet.' : 'No project matches these filters.'}
          </Empty>
        ) : (
          <ul className="grid gap-2 md:gap-x-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            {(active.data as ProjectSummary[]).map((p) => (
              <ProjectRow key={p.id} p={p} have={have} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
