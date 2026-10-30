import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toasts'
import { Empty, ErrorRow, PageTitle, Panel, Person, SkeletonRows } from '../components/ui'
import { meta } from '../lib/meta'
import { api, errorMessage, qs } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, plural, STATUS_LABEL } from '../lib/format'
import type { Connection, UserSummary } from '../lib/types'

/** The connect control for one person, from the caller's connection list. */
export function ConnectButton({ userId, connections }: { userId: number; connections: Connection[] | undefined }) {
  const qc = useQueryClient()
  const toast = useToast()
  const c = connections?.find((x) => x.user.id === userId)
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['connections'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const request = useMutation({ mutationFn: () => api.post('/api/connections', { userId }), onSuccess: done, onError: (e) => toast(errorMessage(e)) })
  const accept = useMutation({ mutationFn: (id: number) => api.post(`/api/connections/${id}/accept`), onSuccess: done, onError: (e) => toast(errorMessage(e)) })
  const remove = useMutation({ mutationFn: (id: number) => api.del(`/api/connections/${id}`), onSuccess: done, onError: (e) => toast(errorMessage(e)) })
  const busy = request.isPending || accept.isPending || remove.isPending
  if (!connections) return <span className="skeleton h-8 w-24" />
  if (!c)
    return (
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => request.mutate()}>
        Connect
      </button>
    )
  if (c.status === 'ACCEPTED') return <span className="pill pill-positive">Connected</span>
  if (c.direction === 'INCOMING')
    return (
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => accept.mutate(c.id)}>
        Accept request
      </button>
    )
  return (
    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => remove.mutate(c.id)}>
      Cancel request
    </button>
  )
}

function useConnections() {
  return useQuery({ queryKey: ['connections'], queryFn: () => api.get<Connection[]>('/api/connections') })
}

/** A row on the list's shared columns (subgrid), so skills and actions line up from row to row. */
function PersonRow({ u, connections, meId }: { u: UserSummary; connections: Connection[] | undefined; meId: number }) {
  const skills = Object.entries(u.skills).sort((a, b) => b[1] - a[1])
  return (
    <li className="row-card grid items-center gap-x-6 gap-y-2 md:col-span-3 md:grid-cols-subgrid">
      <Person id={u.id} name={u.fullName} sub={meta([u.headline, u.department]) ?? STATUS_LABEL[u.availability]} size={40} />
      <span className="flex min-w-0 flex-wrap gap-1.5">
        {skills.slice(0, 6).map(([s, l]) => (
          <span key={s} className="pill" title={`Level ${l} of 5`}>
            {s} <span className="num text-muted">{l}</span>
          </span>
        ))}
      </span>
      <span className="flex items-center gap-3 md:justify-end">
        {u.availability !== 'AVAILABLE' && <span className={u.availability === 'LOOKING' ? 'pill pill-accent' : 'pill'}>{STATUS_LABEL[u.availability]}</span>}
        {u.id !== meId && <ConnectButton userId={u.id} connections={connections} />}
      </span>
    </li>
  )
}

function Directory() {
  const me = useMe()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [skill, setSkill] = useState(params.get('skill') ?? '')
  const [debounced, setDebounced] = useState({ q, skill })
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ q: q.trim(), skill: skill.trim() }), 300)
    return () => clearTimeout(t)
  }, [q, skill])
  useEffect(() => {
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(debounced)) {
          if (v) n.set(k, v)
          else n.delete(k)
        }
        return n
      },
      { replace: true },
    )
  }, [debounced, setParams])

  const people = useQuery({
    queryKey: ['people', debounced],
    queryFn: () => api.get<UserSummary[]>(`/api/users${qs(debounced)}`),
  })
  const connections = useConnections()

  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <span className="sr-only">Search by name or headline</span>
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input className="field !h-9 !pl-9" placeholder="Name or headline" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Skill</span>
          <input className="field !h-9 w-[180px]" placeholder="Has skill, e.g. python" value={skill} onChange={(e) => setSkill(e.target.value)} />
        </label>
      </div>
      <p className="mt-3 text-muted">{people.data ? plural(people.data.length, 'student') : ' '}</p>
      <div className="mt-2">
        {people.isLoading ? (
          <SkeletonRows rows={5} height={92} />
        ) : people.isError ? (
          <ErrorRow error={people.error} retry={() => people.refetch()} />
        ) : people.data!.length === 0 ? (
          <Empty>No student matches that search.</Empty>
        ) : (
          <ul className="grid gap-2 md:gap-x-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            {people.data!.map((u) => (
              <PersonRow key={u.id} u={u} connections={connections.data} meId={me.id} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Network() {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useConnections()
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['connections'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const accept = useMutation({ mutationFn: (id: number) => api.post(`/api/connections/${id}/accept`), onSuccess: done, onError: (e) => toast(errorMessage(e)) })
  const remove = useMutation({ mutationFn: (id: number) => api.del(`/api/connections/${id}`), onSuccess: done, onError: (e) => toast(errorMessage(e)) })

  if (q.isLoading) return <div className="mt-4"><SkeletonRows rows={4} height={56} /></div>
  if (q.isError) return <div className="mt-4"><ErrorRow error={q.error} retry={() => q.refetch()} /></div>
  const incoming = q.data!.filter((c) => c.status === 'PENDING' && c.direction === 'INCOMING')
  const outgoing = q.data!.filter((c) => c.status === 'PENDING' && c.direction === 'OUTGOING')
  const accepted = q.data!.filter((c) => c.status === 'ACCEPTED')

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Panel title="Connections" count={accepted.length}>
          {accepted.length === 0 ? (
            <Empty>Connect with people you meet in projects and classes.</Empty>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {accepted.map((c) => (
                <li key={c.id} className="row-card flex items-center justify-between gap-3">
                  <Person id={c.user.id} name={c.user.fullName} sub={c.user.headline ?? c.user.department ?? ''} />
                  <button
                    type="button"
                    className="btn-text flex-none text-[13px] text-muted"
                    onClick={() => window.confirm(`Remove ${c.user.fullName} from your connections?`) && remove.mutate(c.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-4">
        <Panel title="Asking to connect" count={incoming.length}>
          {incoming.length === 0 ? (
            <Empty>No requests waiting.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {incoming.map((c) => (
                <li key={c.id} className="flex flex-col gap-2">
                  <Person id={c.user.id} name={c.user.fullName} sub={ago(c.createdAt)} />
                  <span className="flex gap-2 pl-11">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => accept.mutate(c.id)}>
                      Accept
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove.mutate(c.id)}>
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {outgoing.length > 0 && (
          <Panel title="Sent" count={outgoing.length}>
            <ul className="flex flex-col gap-3">
              {outgoing.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <Person id={c.user.id} name={c.user.fullName} sub={`Sent ${ago(c.createdAt).toLowerCase()}`} />
                  <button type="button" className="btn-text flex-none text-[13px]" onClick={() => remove.mutate(c.id)}>
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}

export function People() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'network' ? 'network' : 'find'
  return (
    <div>
      <PageTitle title="People" sub="Students on CampusConnect, by what they can do." />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'find'} onClick={() => setParams({})}>
          Find students
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'network'} onClick={() => setParams({ tab: 'network' })}>
          Your network
        </button>
      </div>
      {tab === 'find' ? <Directory /> : <Network />}
    </div>
  )
}
