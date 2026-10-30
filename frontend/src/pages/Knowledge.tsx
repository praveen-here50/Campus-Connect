import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, MessageSquare, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Dialog, Empty, ErrorRow, FieldError, PageTitle, Panel, Sep, SkeletonRows } from '../components/ui'
import { api, qs } from '../lib/api'
import { ago, excerpt, plural } from '../lib/format'
import type { Post, PostDetail } from '../lib/types'

export function VoteButton({ post, size = 'md' }: { post: Post; size?: 'md' | 'lg' }) {
  const qc = useQueryClient()
  const vote = useMutation({
    mutationFn: () => api.post<{ upvotes: number; voted: boolean }>(`/api/posts/${post.id}/vote`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['posts'] })
      void qc.invalidateQueries({ queryKey: ['post', post.id] })
    },
  })
  const voted = vote.data?.voted ?? post.votedByMe
  const count = vote.data?.upvotes ?? post.upvotes
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        vote.mutate()
      }}
      disabled={vote.isPending}
      aria-pressed={voted}
      aria-label={`${voted ? 'Remove upvote' : 'Upvote'} (${count})`}
      className={`flex flex-none flex-col items-center justify-center rounded-[12px] border transition-colors ${
        size === 'lg' ? 'h-16 w-14' : 'h-14 w-12'
      } ${voted ? 'border-accent bg-accent-tint text-accent' : 'border-line bg-raised text-ink hover:border-control'}`}
    >
      <ArrowUp size={15} strokeWidth={2} />
      <span className="num font-medium">{count}</span>
    </button>
  )
}

function PostRow({ p }: { p: Post }) {
  return (
    <li>
      <Link to={`/knowledge/${p.id}`} className="row-card flex gap-4">
        <VoteButton post={p} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{p.title}</span>
            {p.flagged && <span className="pill pill-warning">Hidden by moderation</span>}
          </span>
          <span className="mt-1.5 line-clamp-2 leading-6 text-muted">{excerpt(p.body)}</span>
          {p.tags.length > 0 && (
            <span className="mt-3 flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <span key={t} className="pill">
                  {t}
                </span>
              ))}
            </span>
          )}
          <span className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted">
            <span>
              {p.author.fullName}
              <Sep />
              {ago(p.createdAt)}
            </span>
            <span className="num inline-flex items-center gap-1.5">
              <MessageSquare size={13} aria-hidden="true" /> {plural(p.comments, 'answer')}
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}

function Composer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.post<PostDetail>('/api/posts', {
        title: title.trim(),
        body: body.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
      }),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ['posts'] })
      setTitle('')
      setBody('')
      setTags('')
      onClose()
      navigate(`/knowledge/${d.post.id}`)
    },
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }
  return (
    <Dialog open={open} title="Ask or share something" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="post-title">
            Title
          </label>
          <input id="post-title" className="field" required maxLength={200} placeholder="How do I deploy a Spring Boot app for free?" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="post-body">
            Details
          </label>
          <textarea id="post-body" className="field !min-h-36" required maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="mt-1.5 text-[13px] text-muted">Markdown works, including ``` code blocks.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="post-tags">
            Tags
          </label>
          <input id="post-tags" className="field" aria-describedby="tags-rule" placeholder="spring, deployment" value={tags} onChange={(e) => setTags(e.target.value)} />
          <p id="tags-rule" className="mt-1.5 text-[13px] text-muted">
            Comma-separated, up to 8.
          </p>
        </div>
        <FieldError error={create.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending || !title.trim() || !body.trim()}>
            Post
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function Knowledge() {
  const [params, setParams] = useSearchParams()
  const [composerOpen, setComposerOpen] = useState(false)
  const [q, setQ] = useState(params.get('q') ?? '')
  const mode = params.get('mode') === 'meaning' ? 'meaning' : 'words'
  const sort = params.get('sort') === 'top' ? 'top' : 'new'
  const tag = params.get('tag') ?? ''
  const appliedQ = params.get('q') ?? ''

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  // Keyword search follows typing; meaning search runs on Enter (each one is an AI call).
  useEffect(() => {
    if (mode !== 'words') return
    const t = setTimeout(() => q !== appliedQ && update({ q: q.trim() }), 300)
    return () => clearTimeout(t)
  })

  const posts = useQuery({
    queryKey: ['posts', mode, appliedQ, sort, tag],
    queryFn: () =>
      mode === 'meaning' && appliedQ
        ? api.get<Post[]>(`/api/posts/semantic${qs({ q: appliedQ })}`)
        : api.get<Post[]>(`/api/posts${qs({ q: appliedQ, sort, tag })}`),
  })
  const tags = useQuery({ queryKey: ['posts', 'tags'], queryFn: () => api.get<{ tag: string; count: number }[]>('/api/posts/tags') })

  return (
    <div>
      <PageTitle
        title="Knowledge hub"
        sub="Questions, answers and write-ups from students on campus."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setComposerOpen(true)}>
            Ask a question
          </button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              update({ q: q.trim() })
            }}
          >
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search posts</span>
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                className="field !h-9 !pl-9"
                placeholder={mode === 'meaning' ? 'Describe your problem and press Enter' : 'Search titles and posts'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="inline-flex rounded-full bg-active p-1" role="radiogroup" aria-label="Search mode">
              {(
                [
                  ['words', 'Words'],
                  ['meaning', 'Meaning'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  onClick={() => update({ mode: id === 'words' ? '' : id })}
                  className={`h-7 rounded-full px-3 font-medium ${mode === id ? 'bg-raised text-ink' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!(mode === 'meaning' && appliedQ) && (
              <select className="field !h-9 w-auto" aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'top' ? 'top' : '' })}>
                <option value="new">Newest</option>
                <option value="top">Most upvoted</option>
              </select>
            )}
          </form>
          {tag && (
            <p className="mt-3 flex items-center gap-2 text-muted">
              Tagged <span className="pill">{tag}</span>
              <button type="button" className="btn-text text-[13px]" onClick={() => update({ tag: '' })}>
                Clear
              </button>
            </p>
          )}
          <div className="mt-4">
            {posts.isLoading ? (
              <SkeletonRows rows={5} height={104} />
            ) : posts.isError ? (
              <ErrorRow error={posts.error} retry={() => posts.refetch()} />
            ) : posts.data!.length === 0 ? (
              <Empty action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setComposerOpen(true)}>Ask it</button>}>
                {appliedQ || tag ? 'Nothing matches yet. Be the first to ask.' : 'No posts yet. Start the hub with a question.'}
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {posts.data!.map((p) => (
                  <PostRow key={p.id} p={p} />
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="lg:col-span-4">
          <Panel title="Popular tags">
            {tags.isLoading ? (
              <SkeletonRows rows={4} height={32} />
            ) : !tags.data?.length ? (
              <Empty>Tags appear as people post.</Empty>
            ) : (
              <ul>
                {tags.data.map((t) => (
                  <li key={t.tag}>
                    <button
                      type="button"
                      onClick={() => update({ tag: t.tag === tag ? '' : t.tag, mode: '' })}
                      className={`flex h-9 w-full items-center justify-between rounded-lg px-2 ${t.tag === tag ? 'bg-active' : 'hover:bg-active'}`}
                    >
                      <span>{t.tag}</span>
                      <span className="num text-muted">{t.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  )
}
