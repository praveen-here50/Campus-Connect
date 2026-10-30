import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SkillList } from '../components/SkillEditor'
import { ErrorRow, FieldError, PageTitle, SkeletonRows } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORIES } from '../lib/format'
import type { ProjectDetail, ProjectDraft, ProjectStatus, SaveProject } from '../lib/types'

const EMPTY: SaveProject = { title: '', description: '', category: 'Web', maxMembers: 4, githubRepo: '', skills: [] }

/** Two-column settings layout: what the section is on the left, its fields on the right. */
function Section({ title, help, children }: { title: string; help: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 border-b border-line py-8 first:pt-0 last:border-0 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-1 text-muted">{help}</p>
      </div>
      <div className="panel flex min-w-0 flex-col gap-4 !rounded-2xl !p-4">{children}</div>
    </section>
  )
}

export function ProjectForm() {
  const { id } = useParams()
  const editing = id !== undefined
  const navigate = useNavigate()
  const qc = useQueryClient()
  const existing = useQuery({
    queryKey: ['project', Number(id)],
    queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`),
    enabled: editing,
  })
  const [form, setForm] = useState<SaveProject>(EMPTY)
  const [idea, setIdea] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const set = <K extends keyof SaveProject>(k: K, v: SaveProject[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Fill the form once per loaded project, during render rather than in an effect.
  const [loaded, setLoaded] = useState<ProjectDetail>()
  if (existing.data && existing.data !== loaded) {
    const p = existing.data
    setLoaded(p)
    setForm({ title: p.title, description: p.description, category: p.category, status: p.status, maxMembers: p.maxMembers, githubRepo: p.githubRepo ?? '', skills: p.skills })
  }

  const draft = useMutation({
    mutationFn: () => api.post<ProjectDraft>('/api/ai/project-draft', { idea }),
    onSuccess: (d) => {
      setForm((f) => ({
        ...f,
        title: d.title ?? f.title,
        description: d.description ?? f.description,
        category: CATEGORIES.includes(d.category) ? d.category : f.category,
        skills: (d.skills ?? []).map((s) => s.toLowerCase()).slice(0, 20),
      }))
      setTasks(d.tasks ?? [])
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, githubRepo: form.githubRepo?.trim() || null }
      const p = editing ? await api.put<ProjectDetail>(`/api/projects/${id}`, body) : await api.post<ProjectDetail>('/api/projects', body)
      if (!editing) for (const t of tasks) await api.post(`/api/projects/${p.id}/tasks`, { title: t })
      return p
    },
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['project', p.id] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/projects/${p.id}`)
    },
  })

  const remove = useMutation({
    mutationFn: () => api.del(`/api/projects/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/projects?mine=1')
    },
  })

  if (editing && existing.isLoading) return <SkeletonRows rows={4} height={120} />
  if (editing && existing.isError) return <ErrorRow error={existing.error} retry={() => existing.refetch()} />

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div>
      <PageTitle
        title={editing ? `Edit ${existing.data?.title ?? 'project'}` : 'Start a project'}
        sub={editing ? 'Changes are visible to everyone browsing projects.' : 'Describe what you want to build and who you need. You can change everything later.'}
      />
      <form onSubmit={submit}>
        {!editing && (
          <Section title="Start from an idea" help="Write a few rough sentences. The assistant drafts the title, description, skills and a first task list for you to edit.">
            <label className="sr-only" htmlFor="idea">
              Your idea
            </label>
            <textarea
              id="idea"
              className="field"
              maxLength={2000}
              placeholder="An app that tells students which study rooms in the library are free right now, using the booking system…"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-secondary" disabled={idea.trim().length < 10 || draft.isPending} onClick={() => draft.mutate()}>
                <Sparkles size={15} /> {draft.isPending ? 'Drafting…' : 'Draft it for me'}
              </button>
              {draft.isSuccess && <span className="text-muted">Draft filled in below. Edit anything before publishing.</span>}
            </div>
            <FieldError error={draft.error} />
          </Section>
        )}

        <Section title="The project" help="What students see first in the project list.">
          <div>
            <label className="field-label" htmlFor="title">
              Title
            </label>
            <input id="title" className="field" required maxLength={160} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="description">
              Description
            </label>
            <textarea id="description" className="field !min-h-40" required maxLength={5000} value={form.description} onChange={(e) => set('description', e.target.value)} />
            <p className="mt-1.5 text-[13px] text-muted">Markdown works: **bold**, lists, `code`.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="category">
                Category
              </label>
              <select id="category" className="field" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {editing && (
              <div>
                <label className="field-label" htmlFor="status">
                  Status
                </label>
                <select id="status" className="field" value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
                  <option value="OPEN">Recruiting</option>
                  <option value="IN_PROGRESS">Building (not recruiting)</option>
                  <option value="COMPLETED">Shipped</option>
                </select>
              </div>
            )}
          </div>
        </Section>

        <Section title="The team" help="Matching uses these skills to suggest students to you and your project to them.">
          <div>
            <label className="field-label" htmlFor="maxMembers">
              Team size, including you
            </label>
            <input
              id="maxMembers"
              type="number"
              min={2}
              max={20}
              className="field num w-32"
              value={form.maxMembers}
              onChange={(e) => set('maxMembers', Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="skills">
              Skills needed
            </label>
            <SkillList id="skills" value={form.skills} onChange={(v) => set('skills', v)} />
          </div>
          <div>
            <label className="field-label" htmlFor="repo">
              GitHub repository <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="repo" className="field" placeholder="owner/repo" maxLength={255} value={form.githubRepo ?? ''} onChange={(e) => set('githubRepo', e.target.value)} />
          </div>
        </Section>

        {!editing && tasks.length > 0 && (
          <Section title="First tasks" help="Added to the team's board when you publish. Remove any you don't want.">
            <ul className="flex flex-col gap-2">
              {tasks.map((t) => (
                <li key={t} className="row-card flex items-center justify-between gap-3 !py-2">
                  <span>{t}</span>
                  <button type="button" className="btn-text text-[13px]" onClick={() => setTasks((l) => l.filter((x) => x !== t))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-6">
          <FieldError error={save.error} />
          <Link to={editing ? `/projects/${id}` : '/projects'} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !form.title.trim() || !form.description.trim()}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Publish project'}
          </button>
        </div>

        {editing && (
          <section className="mt-12 border-t border-line pt-8">
            <h2 className="text-base font-medium">Delete this project</h2>
            <p className="mt-1 max-w-[560px] text-muted">
              Removes the project, its chat, tasks and activity for every member. This cannot be undone.
            </p>
            <FieldError error={remove.error} />
            <button
              type="button"
              className="btn btn-secondary btn-danger mt-4"
              disabled={remove.isPending}
              onClick={() => window.confirm(`Delete “${existing.data?.title}” for everyone?`) && remove.mutate()}
            >
              Delete project
            </button>
          </section>
        )}
      </form>
    </div>
  )
}
