import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { useToast } from '../components/Toasts'
import { Empty, ErrorRow, FieldError, Person, SkeletonRows } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, plural } from '../lib/format'
import type { Comment, PostDetail } from '../lib/types'
import { VoteButton } from './Knowledge'

export function PostPage() {
  const { id } = useParams()
  const postId = Number(id)
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const key = ['post', postId]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<PostDetail>(`/api/posts/${postId}`) })
  const [answer, setAnswer] = useState('')

  const comment = useMutation({
    mutationFn: () => api.post<Comment>(`/api/posts/${postId}/comments`, { body: answer.trim() }),
    onSuccess: (c) => {
      qc.setQueryData<PostDetail>(key, (d) => d && { ...d, comments: [...d.comments, c], post: { ...d.post, comments: d.post.comments + 1 } })
      void qc.invalidateQueries({ queryKey: ['posts'] })
      setAnswer('')
    },
  })
  const removeComment = useMutation({
    mutationFn: (cid: number) => api.del(`/api/comments/${cid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast(errorMessage(e)),
  })
  const removePost = useMutation({
    mutationFn: () => api.del(`/api/posts/${postId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['posts'] })
      navigate('/knowledge')
    },
    onError: (e) => toast(errorMessage(e)),
  })

  if (q.isLoading) return <SkeletonRows rows={3} height={120} />
  if (q.isError || !q.data) return <ErrorRow error={q.error} retry={() => q.refetch()} />
  const { post, comments } = q.data

  function submit(e: FormEvent) {
    e.preventDefault()
    if (answer.trim()) comment.mutate()
  }

  return (
    <article className="max-w-[820px]">
      <p className="mb-2 text-muted">
        <Link to="/knowledge" className="hover:text-ink">
          Knowledge hub
        </Link>
      </p>
      <div className="flex gap-5">
        <VoteButton post={post} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-8 font-semibold">{post.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {post.tags.map((t) => (
              <Link key={t} to={`/knowledge?tag=${encodeURIComponent(t)}`} className="pill hover:bg-active">
                {t}
              </Link>
            ))}
            {post.flagged && <span className="pill pill-warning">Hidden by moderation: only you can see it</span>}
          </div>
        </div>
      </div>

      <div className="mt-6 text-[15px]">
        <Markdown text={post.body} />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-6">
        <Person id={post.author.id} name={post.author.fullName} sub={`Posted ${ago(post.createdAt).toLowerCase()}`} />
        {post.author.id === me.id && (
          <button type="button" className="btn-text btn-danger text-[13px]" onClick={() => window.confirm('Delete this post and its answers?') && removePost.mutate()}>
            Delete post
          </button>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold">{plural(comments.length, 'answer')}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {comments.length === 0 && <Empty>No answers yet. If you know, help out below.</Empty>}
          {comments.map((c) => (
            <div key={c.id} className="panel !p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Person id={c.author.id} name={c.author.fullName} sub={ago(c.createdAt)} size={28} />
                {(c.author.id === me.id || post.author.id === me.id) && (
                  <button type="button" className="btn-text text-[13px] text-muted" onClick={() => window.confirm('Delete this answer?') && removeComment.mutate(c.id)}>
                    Delete
                  </button>
                )}
              </div>
              <Markdown text={c.body} />
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6">
          <label className="field-label" htmlFor="answer">
            Your answer
          </label>
          <textarea id="answer" className="field !min-h-28" maxLength={5000} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <FieldError error={comment.error} />
          <div className="mt-3 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={!answer.trim() || comment.isPending}>
              Post answer
            </button>
          </div>
        </form>
      </section>
    </article>
  )
}
