import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useToast } from '../components/Toasts'
import { Avatar, Empty, ErrorRow, FieldError, Panel, SkeletonRows } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { useMe } from '../lib/auth'
import { ago, clock, STATUS_LABEL } from '../lib/format'
import { publish, useSubscription } from '../lib/socket'
import type { Activity, ChatMessage, ProjectDetail, Task, TaskStatus } from '../lib/types'

const COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

export function Workspace({ project }: { project: ProjectDetail }) {
  const [view, setView] = useState<'board' | 'chat' | 'activity'>('board')
  return (
    <div>
      <div className="mb-4 inline-flex rounded-full bg-active p-1" role="tablist" aria-label="Workspace">
        {(
          [
            ['board', 'Task board'],
            ['chat', 'Team chat'],
            ['activity', 'Activity'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`h-8 rounded-full px-4 font-medium ${view === id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'board' && <Board project={project} />}
      {view === 'chat' && <Chat project={project} />}
      {view === 'activity' && <ActivityFeed project={project} />}
    </div>
  )
}

function Board({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['tasks', project.id]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Task[]>(`/api/projects/${project.id}/tasks`) })
  const [title, setTitle] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const create = useMutation({
    mutationFn: (t: string) => api.post<Task>(`/api/projects/${project.id}/tasks`, { title: t }),
    onSuccess: invalidate,
    onError: (e) => toast(errorMessage(e)),
  })
  const update = useMutation({
    mutationFn: (t: Task) => api.put<Task>(`/api/tasks/${t.id}`, { title: t.title, status: t.status, assigneeId: t.assigneeId }),
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Task[]>(key)
      qc.setQueryData<Task[]>(key, (list) => list?.map((x) => (x.id === t.id ? t : x)))
      return { prev }
    },
    onError: (e, _t, ctx) => {
      qc.setQueryData(key, ctx?.prev)
      toast(errorMessage(e))
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/tasks/${id}`),
    onSuccess: invalidate,
    onError: (e) => toast(errorMessage(e)),
  })
  const suggest = useMutation({
    mutationFn: () => api.post<{ tasks: string[] }>(`/api/ai/projects/${project.id}/task-suggestions`),
    onSuccess: (r) => setSuggestions(r.tasks ?? []),
  })

  function add(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    create.mutate(t)
    setTitle('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={add} className="flex min-w-[260px] flex-1 gap-2">
          <label className="sr-only" htmlFor="new-task">
            New task
          </label>
          <input id="new-task" className="field" maxLength={200} placeholder="Add a task, e.g. Wire up the login form" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || create.isPending}>
            Add
          </button>
        </form>
        <button type="button" className="btn btn-secondary" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
          <Sparkles size={15} /> {suggest.isPending ? 'Thinking…' : 'Suggest next tasks'}
        </button>
      </div>
      <FieldError error={suggest.error} />
      {suggestions.length > 0 && (
        <Panel title="Suggested by the assistant" action={<button type="button" className="btn-text" onClick={() => setSuggestions([])}>Dismiss</button>}>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s} className="row-card flex items-center justify-between gap-3 !py-2">
                <span>{s}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    create.mutate(s)
                    setSuggestions((list) => list.filter((x) => x !== s))
                  }}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {q.isLoading ? (
        <SkeletonRows rows={3} height={120} />
      ) : q.isError ? (
        <ErrorRow error={q.error} retry={() => q.refetch()} />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const tasks = q.data!.filter((t) => t.status === col)
            return (
              <Panel key={col} title={STATUS_LABEL[col]} count={tasks.length} className="!p-4">
                {tasks.length === 0 ? (
                  <Empty>{col === 'DONE' ? 'Nothing finished yet.' : col === 'TODO' ? 'Nothing waiting.' : 'Nobody is on anything.'}</Empty>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {tasks.map((t) => (
                      <TaskCard key={t.id} task={t} project={project} onChange={(next) => update.mutate(next)} onDelete={() => remove.mutate(t.id)} />
                    ))}
                  </ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, project, onChange, onDelete }: { task: Task; project: ProjectDetail; onChange: (t: Task) => void; onDelete: () => void }) {
  const me = useMe()
  return (
    <li className="row-card flex flex-col gap-3 !p-3">
      <div className="flex items-start justify-between gap-2">
        <span className={`font-medium ${task.status === 'DONE' ? 'text-muted line-through' : ''}`}>{task.title}</span>
        <button type="button" className="flex-none p-1 text-muted hover:text-[var(--negative)]" aria-label={`Delete task ${task.title}`} onClick={() => window.confirm('Delete this task?') && onDelete()}>
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`assignee-${task.id}`}>
          Assignee
        </label>
        <select
          id={`assignee-${task.id}`}
          className="field !h-8 min-w-0 flex-1 text-[13px]"
          value={task.assigneeId ?? ''}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null
            onChange({ ...task, assigneeId: id, assigneeName: project.members.find((m) => m.userId === id)?.fullName ?? null })
          }}
        >
          <option value="">Unassigned</option>
          {project.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userId === me.id ? `${m.fullName} (you)` : m.fullName}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`status-${task.id}`}>
          Status
        </label>
        <select id={`status-${task.id}`} className="field !h-8 w-auto text-[13px]" value={task.status} onChange={(e) => onChange({ ...task, status: e.target.value as TaskStatus })}>
          {COLUMNS.map((c) => (
            <option key={c} value={c}>
              {STATUS_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}

function Chat({ project }: { project: ProjectDetail }) {
  const me = useMe()
  const qc = useQueryClient()
  const key = ['messages', project.id]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<ChatMessage[]>(`/api/projects/${project.id}/messages`) })
  const [text, setText] = useState('')
  const [error, setError] = useState<unknown>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useSubscription<ChatMessage>(`/topic/projects/${project.id}/chat`, (m) => {
    qc.setQueryData<ChatMessage[]>(key, (list) => (list?.some((x) => x.id === m.id) ? list : [...(list ?? []), m]))
  })

  useLayoutEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [q.data?.length])

  async function send(e: FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setText('')
    setError(null)
    // Prefer the socket; fall back to REST if it is not connected.
    if (publish(`/app/projects/${project.id}/chat`, { content })) return
    try {
      const m = await api.post<ChatMessage>(`/api/projects/${project.id}/messages`, { content })
      qc.setQueryData<ChatMessage[]>(key, (list) => (list?.some((x) => x.id === m.id) ? list : [...(list ?? []), m]))
    } catch (err) {
      setError(err)
      setText(content)
    }
  }

  return (
    <section className="panel flex h-[min(640px,calc(100svh-260px))] min-h-[420px] flex-col !p-0" aria-label="Team chat">
      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4">
        {q.isLoading ? (
          <SkeletonRows rows={4} height={44} />
        ) : q.isError ? (
          <ErrorRow error={q.error} retry={() => q.refetch()} />
        ) : q.data!.length === 0 ? (
          <Empty>No messages yet. Say hello to {project.members.length > 1 ? 'your team' : 'future teammates'}.</Empty>
        ) : (
          <ol className="flex flex-col gap-3">
            {q.data!.map((m, i) => {
              const prev = q.data![i - 1]
              const grouped = prev && prev.senderId === m.senderId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000
              const mine = m.senderId === me.id
              return (
                <li key={m.id} className={`flex gap-3 ${grouped ? '-mt-2' : ''}`}>
                  <span className="w-8 flex-none">{!grouped && <Avatar id={m.senderId} name={m.senderName} />}</span>
                  <div className="min-w-0 flex-1">
                    {!grouped && (
                      <p className="flex items-baseline gap-2">
                        <span className="font-semibold">{mine ? 'You' : m.senderName}</span>
                        <span className="text-[12px] text-muted">{clock(m.createdAt)}</span>
                      </p>
                    )}
                    <p className="whitespace-pre-line [overflow-wrap:anywhere]">{m.content}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={1}
          className="field !min-h-10 flex-1 resize-none"
          placeholder={`Message ${project.title}`}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" className="btn btn-primary w-10 px-0" aria-label="Send" disabled={!text.trim()}>
          <Send size={16} />
        </button>
      </form>
      {error != null && <p className="px-4 pb-3 text-[var(--negative)]">{errorMessage(error)}</p>}
    </section>
  )
}

function ActivityFeed({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient()
  const key = ['activity', project.id]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Activity[]>(`/api/projects/${project.id}/activity`) })
  useSubscription<Activity>(`/topic/projects/${project.id}/activity`, (a) => {
    qc.setQueryData<Activity[]>(key, (list) => (list?.some((x) => x.id === a.id) ? list : [a, ...(list ?? [])]))
  })
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Panel title="What happened">
          {q.isLoading ? (
            <SkeletonRows rows={5} height={44} />
          ) : q.isError ? (
            <ErrorRow error={q.error} retry={() => q.refetch()} />
          ) : q.data!.length === 0 ? (
            <Empty>New members, finished tasks and GitHub pushes appear here as they happen.</Empty>
          ) : (
            <ul>
              {q.data!.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 border-b border-rule py-3 last:border-0">
                  <span className="min-w-0">
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer noopener" className="hover:underline">
                        {a.summary}
                      </a>
                    ) : (
                      a.summary
                    )}
                    <span className="block text-[13px] text-muted">{a.source === 'GITHUB' ? 'GitHub' : 'CampusConnect'}</span>
                  </span>
                  <span className="flex-none text-[13px] text-muted">{ago(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="lg:col-span-4">
        <Panel title="Connect GitHub">
          {project.githubRepo ? (
            <div className="space-y-2">
              <p>
                Linked to <span className="font-medium">{project.githubRepo}</span>.
              </p>
              <p className="text-muted">
                In the repository's settings, add a webhook to <code className="rounded bg-active px-1">/api/integrations/github</code> on your
                CampusConnect server, content type JSON, with the shared secret, for push and pull request events.
              </p>
            </div>
          ) : (
            <p className="text-muted">
              {project.myRole === 'OWNER'
                ? 'Add the repository in Edit project, then pushes and pull requests show up in this feed.'
                : 'The owner can link a GitHub repository so pushes show up here.'}
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}
