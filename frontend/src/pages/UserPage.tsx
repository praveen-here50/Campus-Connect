import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Avatar, Empty, ErrorRow, Panel, SeatCount, Sep, SkeletonRows, StatusPill } from '../components/ui'
import { meta } from '../lib/meta'
import { api, qs } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, LEVEL_LABEL, STATUS_LABEL } from '../lib/format'
import type { Connection, Post, ProjectSummary, PublicProfile } from '../lib/types'
import { ConnectButton } from './People'

export function UserPage() {
  const { id } = useParams()
  const userId = Number(id)
  const me = useMe()
  const user = useQuery({ queryKey: ['user', userId], queryFn: () => api.get<PublicProfile>(`/api/users/${userId}`) })
  const projects = useQuery({ queryKey: ['projects', 'by-user', userId], queryFn: () => api.get<ProjectSummary[]>(`/api/projects/by-user/${userId}`) })
  const posts = useQuery({ queryKey: ['posts', 'author', userId], queryFn: () => api.get<Post[]>(`/api/posts${qs({ author: userId })}`) })
  const connections = useQuery({ queryKey: ['connections'], queryFn: () => api.get<Connection[]>('/api/connections') })

  if (userId === me.id) return <Navigate to="/profile" replace />
  if (user.isLoading) return <SkeletonRows rows={3} height={120} />
  if (user.isError || !user.data) return <ErrorRow error={user.error} retry={() => user.refetch()} />
  const u = user.data
  const skills = Object.entries(u.skills).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <Avatar id={u.id} name={u.fullName} size={72} />
          <div className="min-w-0">
            <h1 className="text-2xl leading-8 font-semibold">{u.fullName}</h1>
            <p className="text-[15px] text-muted">
              {meta([u.headline, u.department, u.yearOfStudy && `Year ${u.yearOfStudy}`]) ?? 'Student'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={u.availability === 'LOOKING' ? 'pill pill-accent' : 'pill'}>{STATUS_LABEL[u.availability]}</span>
          {u.githubUrl && (
            <a className="btn btn-secondary btn-sm" href={u.githubUrl} target="_blank" rel="noreferrer noopener">
              GitHub <ExternalLink size={13} />
            </a>
          )}
          {u.linkedinUrl && (
            <a className="btn btn-secondary btn-sm" href={u.linkedinUrl} target="_blank" rel="noreferrer noopener">
              LinkedIn <ExternalLink size={13} />
            </a>
          )}
          {u.portfolioUrl && (
            <a className="btn btn-secondary btn-sm" href={u.portfolioUrl} target="_blank" rel="noreferrer noopener">
              Portfolio <ExternalLink size={13} />
            </a>
          )}
          <ConnectButton userId={u.id} connections={connections.data} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          {u.bio && (
            <Panel title="About">
              <p className="text-[15px] leading-6 whitespace-pre-line">{u.bio}</p>
            </Panel>
          )}
          <Panel title="Projects" count={projects.data?.length}>
            {projects.isLoading ? (
              <SkeletonRows rows={2} />
            ) : !projects.data?.length ? (
              <Empty>Not on a project yet.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {projects.data.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="row-card flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.title}</span>
                        <span className="block text-[13px] text-muted">
                          {p.ownerId === u.id ? 'Started it' : 'Member'}
                          <Sep />
                          {p.category}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <SeatCount taken={p.memberCount} max={p.maxMembers} />
                        <StatusPill status={p.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Posts in the knowledge hub" count={posts.data?.length}>
            {posts.isLoading ? (
              <SkeletonRows rows={2} />
            ) : !posts.data?.length ? (
              <Empty>No posts yet.</Empty>
            ) : (
              <ul>
                {posts.data.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 last:border-0">
                    <Link to={`/knowledge/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {p.title}
                    </Link>
                    <span className="num flex-none text-[13px] text-muted">
                      {p.upvotes} up
                      <Sep />
                      {ago(p.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="lg:col-span-4">
          <Panel title="Skills" count={skills.length}>
            {skills.length === 0 ? (
              <Empty>No skills listed.</Empty>
            ) : (
              <ul>
                {skills.map(([s, l]) => (
                  <li key={s} className="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-0">
                    <span className="font-medium">{s}</span>
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      {LEVEL_LABEL[l]}
                      <span className="flex gap-[3px]" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} className={`h-1.5 w-3 rounded-full ${i <= l ? 'bg-ink' : 'bg-active'}`} />
                        ))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
