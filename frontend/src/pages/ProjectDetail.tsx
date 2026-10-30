import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { useToast } from '../components/Toasts'
import { Avatar, Dialog, Empty, ErrorRow, FieldError, Panel, Person, SeatStrip, SkeletonRows, StatusPill } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, plural } from '../lib/format'
import type { ApplicationView, ProjectDetail as Detail, PublicProfile, UserMatch } from '../lib/types'
import { Workspace } from './Workspace'

type Tab = 'overview' | 'workspace' | 'requests'

export function ProjectDetail({ initialTab }: { initialTab?: Tab }) {
  const { id } = useParams()
  const projectId = Number(id)
  const me = useMe()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Detail>(`/api/projects/${projectId}`) })
  const p = q.data
  const isMember = !!p?.myRole
  const isOwner = p?.myRole === 'OWNER'
  const tab: Tab = initialTab === 'workspace' && isMember ? 'workspace' : initialTab === 'requests' && isOwner ? 'requests' : 'overview'
  const setTab = (t: Tab) => navigate(t === 'overview' ? `/projects/${projectId}` : `/projects/${projectId}/${t}`, { replace: true })

  if (q.isLoading) return <SkeletonRows rows={4} height={120} />
  if (q.isError || !p) return <ErrorRow error={q.error} retry={() => q.refetch()} />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-muted">
            <Link to="/projects" className="hover:text-ink">
              Projects
            </Link>{' '}
            / {p.category}
          </p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl leading-8 font-semibold">
            {p.title} <StatusPill status={p.status} />
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            Started {ago(p.createdAt)} by {p.members.find((m) => m.role === 'OWNER')?.fullName ?? 'a student'}
          </p>
        </div>
        <ProjectActions p={p} meId={me.id} />
      </div>

      {isMember && (
        <div className="tabs mb-6" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'workspace'} onClick={() => setTab('workspace')}>
            Team workspace
          </button>
          {isOwner && (
            <button type="button" role="tab" className="tab" aria-selected={tab === 'requests'} onClick={() => setTab('requests')}>
              Requests
            </button>
          )}
        </div>
      )}

      {tab === 'overview' && <Overview p={p} />}
      {tab === 'workspace' && <Workspace project={p} />}
      {tab === 'requests' && <Requests projectId={p.id} />}
    </div>
  )
}

function ProjectActions({ p, meId }: { p: Detail; meId: number }) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [applyOpen, setApplyOpen] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = () => qc.invalidateQueries({ queryKey: ['project', p.id] })

  const apply = useMutation({
    mutationFn: () => api.post<ApplicationView>(`/api/projects/${p.id}/applications`, { message: message.trim() || null }),
    onSuccess: () => {
      setApplyOpen(false)
      toast('Application sent. The owner has been notified.')
      void refresh()
    },
  })
  const withdraw = useMutation({
    mutationFn: (appId: number) => api.del(`/api/applications/${appId}`),
    onSuccess: () => void refresh(),
    onError: (e) => toast(errorMessage(e)),
  })
  const decide = useMutation({
    mutationFn: ({ appId, accept }: { appId: number; accept: boolean }) => api.post(`/api/applications/${appId}/${accept ? 'accept' : 'reject'}`),
    onSuccess: (_, v) => {
      toast(v.accept ? `You joined ${p.title}.` : 'Invitation declined.')
      void refresh()
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast(errorMessage(e)),
  })
  const leave = useMutation({
    mutationFn: () => api.del(`/api/projects/${p.id}/members/${meId}`),
    onSuccess: () => {
      toast(`You left ${p.title}.`)
      void refresh()
    },
    onError: (e) => toast(errorMessage(e)),
  })

  const req = p.myRequest
  const full = p.members.length >= p.maxMembers
  return (
    <div className="flex flex-wrap items-center gap-2">
      {p.myRole === 'OWNER' && (
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/projects/${p.id}/edit`)}>
          <Pencil size={14} /> Edit project
        </button>
      )}
      {p.myRole === 'MEMBER' && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={leave.isPending}
          onClick={() => window.confirm(`Leave ${p.title}? Your tasks will be unassigned.`) && leave.mutate()}
        >
          Leave team
        </button>
      )}
      {!p.myRole && req?.kind === 'INVITE' && (
        <>
          <span className="text-muted">You're invited.</span>
          <button type="button" className="btn btn-secondary" disabled={decide.isPending} onClick={() => decide.mutate({ appId: req.id, accept: false })}>
            Decline
          </button>
          <button type="button" className="btn btn-primary" disabled={decide.isPending} onClick={() => decide.mutate({ appId: req.id, accept: true })}>
            Join the team
          </button>
        </>
      )}
      {!p.myRole && req?.kind === 'APPLY' && (
        <>
          <span className="text-muted">Application sent {ago(req.createdAt)}</span>
          <button type="button" className="btn btn-secondary" disabled={withdraw.isPending} onClick={() => withdraw.mutate(req.id)}>
            Withdraw
          </button>
        </>
      )}
      {!p.myRole && !req && p.status === 'OPEN' && (
        <button type="button" className="btn btn-primary" disabled={full} onClick={() => setApplyOpen(true)}>
          {full ? 'Team is full' : 'Ask to join'}
        </button>
      )}
      {p.githubRepo && (
        <a
          className="btn btn-secondary"
          href={p.githubRepo.startsWith('http') ? p.githubRepo : `https://github.com/${p.githubRepo}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Repository <ExternalLink size={14} />
        </a>
      )}

      <Dialog open={applyOpen} title={`Ask to join ${p.title}`} onClose={() => setApplyOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            apply.mutate()
          }}
        >
          <label className="field-label" htmlFor="apply-msg">
            Message to the owner
          </label>
          <textarea
            id="apply-msg"
            className="field"
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What you'd work on, and when you're free"
          />
          <FieldError error={apply.error} />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={apply.isPending}>
              Send request
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

/** Which required skill is covered by whom: the gap a new teammate would fill. */
function SkillCoverage({ p }: { p: Detail }) {
  const profiles = useQueries({
    queries: p.members.map((m) => ({ queryKey: ['user', m.userId], queryFn: () => api.get<PublicProfile>(`/api/users/${m.userId}`) })),
  })
  if (p.skills.length === 0) return <Empty>The owner has not listed required skills.</Empty>
  const loaded = profiles.every((r) => r.data)
  return (
    <ul className="flex flex-col">
      {p.skills.map((skill) => {
        const who = profiles.map((r) => r.data).filter((u): u is PublicProfile => !!u && skill in u.skills)
        return (
          <li key={skill} className="flex min-h-11 items-center justify-between gap-4 border-b border-rule py-2 last:border-0">
            <span className="font-medium">{skill}</span>
            {!loaded ? (
              <span className="skeleton h-5 w-24" />
            ) : who.length ? (
              <span className="flex items-center gap-1.5">
                {who.map((u) => (
                  <span key={u.id} title={`${u.fullName}: level ${u.skills[skill]} of 5`}>
                    <Avatar id={u.id} name={u.fullName} size={24} />
                  </span>
                ))}
              </span>
            ) : (
              <span className="pill pill-accent">Open seat</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Overview({ p }: { p: Detail }) {
  const me = useMe()
  const isOwner = p.myRole === 'OWNER'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-8">
        <Panel title="About the project">
          <Markdown text={p.description} />
        </Panel>
        {isOwner && p.status !== 'COMPLETED' && <Teammates p={p} />}
      </div>
      <div className="flex flex-col gap-4 lg:col-span-4">
        <Panel title="Team" count={p.members.length}>
          <div className="mb-4">
            <SeatStrip members={p.members.map((m) => ({ id: m.userId, name: m.fullName }))} max={p.maxMembers} />
          </div>
          <ul className="flex flex-col gap-3">
            {p.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3">
                <Person id={m.userId} name={m.fullName} sub={m.headline ?? `Joined ${ago(m.joinedAt)}`} />
                {m.role === 'OWNER' ? <span className="pill">Owner</span> : isOwner && <RemoveMember projectId={p.id} userId={m.userId} name={m.fullName} />}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Skills needed">
          <SkillCoverage p={p} />
          {!p.myRole && p.skills.some((s) => s in me.skills) && (
            <p className="mt-3 text-[13px] text-muted">
              You have {plural(p.skills.filter((s) => s in me.skills).length, 'of these skills', 'of these skills')}.
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function RemoveMember({ projectId, userId, name }: { projectId: number; userId: number; name: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const m = useMutation({
    mutationFn: () => api.del(`/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
    onError: (e) => toast(errorMessage(e)),
  })
  return (
    <button type="button" className="btn-text btn-danger text-[13px]" disabled={m.isPending} onClick={() => window.confirm(`Remove ${name} from the team?`) && m.mutate()}>
      Remove
    </button>
  )
}

function Teammates({ p }: { p: Detail }) {
  const toast = useToast()
  const q = useQuery({
    queryKey: ['teammates', p.id],
    queryFn: () => api.get<UserMatch[]>(`/api/ai/recommendations/projects/${p.id}/teammates?limit=6`),
  })
  const [invited, setInvited] = useState<Set<number>>(new Set())
  const invite = useMutation({
    mutationFn: (userId: number) => api.post(`/api/projects/${p.id}/invites`, { userId }),
    onSuccess: (_, userId) => {
      setInvited((s) => new Set(s).add(userId))
      toast('Invitation sent.')
    },
    onError: (e) => toast(errorMessage(e)),
  })
  const full = p.members.length >= p.maxMembers
  return (
    <Panel title="Students who fit this project">
      {q.isLoading ? (
        <SkeletonRows rows={3} height={56} />
      ) : q.isError ? (
        <ErrorRow error={q.error} retry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <Empty>No available student matches the required skills yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data!.map((m) => (
            <li key={m.user.id} className="row-card flex flex-wrap items-center justify-between gap-3">
              <Person id={m.user.id} name={m.user.fullName} sub={m.matchedSkills.length ? `Has ${m.matchedSkills.join(', ')}` : (m.user.headline ?? m.user.department ?? '')} />
              <span className="flex items-center gap-4">
                <span className="num text-accent">{m.score}%</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={full || invited.has(m.user.id) || invite.isPending}
                  onClick={() => invite.mutate(m.user.id)}
                >
                  {invited.has(m.user.id) ? 'Invited' : 'Invite'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Requests({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['applications', projectId], queryFn: () => api.get<ApplicationView[]>(`/api/projects/${projectId}/applications`) })
  const act = useMutation({
    mutationFn: ({ a, action }: { a: ApplicationView; action: 'accept' | 'reject' | 'withdraw' }) =>
      action === 'withdraw' ? api.del(`/api/applications/${a.id}`) : api.post(`/api/applications/${a.id}/${action}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['applications', projectId] })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast(errorMessage(e)),
  })
  if (q.isLoading) return <SkeletonRows rows={3} />
  if (q.isError) return <ErrorRow error={q.error} retry={() => q.refetch()} />
  const pending = q.data!.filter((a) => a.status === 'PENDING')
  const decided = q.data!.filter((a) => a.status !== 'PENDING')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Panel title="Waiting for an answer" count={pending.length}>
          {pending.length === 0 ? (
            <Empty>No open applications or invitations.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((a) => (
                <li key={a.id} className="row-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Person id={a.userId} name={a.userName} sub={`${a.kind === 'APPLY' ? 'Asked to join' : 'You invited them'} ${ago(a.createdAt)}`} />
                    {a.kind === 'APPLY' ? (
                      <span className="flex gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" disabled={act.isPending} onClick={() => act.mutate({ a, action: 'reject' })}>
                          Decline
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" disabled={act.isPending} onClick={() => act.mutate({ a, action: 'accept' })}>
                          Accept
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={act.isPending} onClick={() => act.mutate({ a, action: 'withdraw' })}>
                        Cancel invite
                      </button>
                    )}
                  </div>
                  {a.message && <p className="mt-2 border-l-2 border-control pl-3 whitespace-pre-line">{a.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="lg:col-span-4">
        <Panel title="Decided">
          {decided.length === 0 ? (
            <Empty>Nothing decided yet.</Empty>
          ) : (
            <ul className="flex flex-col">
              {decided.slice(0, 10).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-0">
                  <span className="min-w-0 truncate">{a.userName}</span>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

