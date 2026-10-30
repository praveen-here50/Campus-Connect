import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUp } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { Avatar, Empty, Logo, PageTitle } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { useMe } from '../lib/auth'
import type { AssistantAnswer, AssistantTurn } from '../lib/types'

interface Turn extends AssistantTurn {
  sources?: AssistantAnswer['sources']
  failed?: boolean
}

const KEY = 'cc.assistant'

function loadTurns(): Turn[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Turn[]
  } catch {
    return []
  }
}

function saveTurns(turns: Turn[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-30)))
  } catch {
    // not kept across reloads
  }
}

export function Assistant() {
  const me = useMe()
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<{ enabled: boolean }>('/api/ai/status'), staleTime: 5 * 60_000 })
  const [turns, setTurns] = useState<Turn[]>(loadTurns)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const topSkill = Object.entries(me.skills).sort((a, b) => b[1] - a[1])[0]?.[0]
  const starters = [
    'Which open projects could use my skills, and what should I learn to join them?',
    topSkill ? `What is a good portfolio project to level up my ${topSkill}?` : 'How do I pick skills to list on my profile?',
    'How should a team of four split work on a two-month web project?',
  ]

  const ask = useMutation({
    mutationFn: (question: string) =>
      api.post<AssistantAnswer>('/api/ai/assistant', {
        question,
        history: turns.filter((t) => !t.failed).slice(-6).map(({ role, content }) => ({ role, content })),
      }),
    onSuccess: (a) => {
      setTurns((list) => {
        const next = [...list, { role: 'assistant' as const, content: a.answer, sources: a.sources }]
        saveTurns(next)
        return next
      })
    },
    onError: (e) => setTurns((list) => [...list, { role: 'assistant', content: errorMessage(e), failed: true }]),
  })

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, ask.isPending])

  function send(question: string) {
    const q = question.trim()
    if (!q || ask.isPending) return
    setTurns((list) => {
      const next = [...list, { role: 'user' as const, content: q }]
      saveTurns(next)
      return next
    })
    setText('')
    ask.mutate(q)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    send(text)
  }

  return (
    <div className="flex min-h-[calc(100svh-120px)] flex-col">
      <PageTitle
        title="Assistant"
        sub="Answers from what students have posted in the knowledge hub and from open projects, with sources."
        actions={
          turns.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setTurns([])
                saveTurns([])
              }}
            >
              New conversation
            </button>
          )
        }
      />

      {status.data && !status.data.enabled && (
        <Empty>The assistant is switched off on this server: an administrator needs to set the AI API key.</Empty>
      )}

      <div className="flex-1">
        {turns.length === 0 ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {starters.map((s) => (
              <button key={s} type="button" className="row-card text-left" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <ol className="flex flex-col gap-6">
            {turns.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex-none">{t.role === 'user' ? <Avatar id={me.id} name={me.fullName} /> : <Logo withName={false} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 font-semibold">{t.role === 'user' ? 'You' : 'Assistant'}</p>
                  {t.role === 'user' ? (
                    <p className="whitespace-pre-line">{t.content}</p>
                  ) : t.failed ? (
                    <p className="text-[var(--negative)]">{t.content}</p>
                  ) : (
                    <Markdown text={t.content} />
                  )}
                  {t.sources && t.sources.length > 0 && (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                      Sources:
                      {t.sources.map((s) => (
                        <Link key={`${s.kind}${s.id}`} to={s.kind === 'POST' ? `/knowledge/${s.id}` : `/projects/${s.id}`} className="pill hover:bg-active">
                          {s.title}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {ask.isPending && (
              <li className="flex gap-3">
                <span className="mt-0.5 flex-none">
                  <Logo withName={false} />
                </span>
                <div className="min-w-0 flex-1" role="status" aria-live="polite">
                  <p className="mb-1 font-semibold">Assistant</p>
                  <p className="flex items-center gap-2.5 text-muted">
                    Thinking
                    <span className="thinking" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </p>
                </div>
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="sticky bottom-0 mt-6 bg-ground pt-2 pb-4">
        <div className="flex items-end gap-2 rounded-[22px] border border-line bg-surface p-2 focus-within:border-control">
          <label className="sr-only" htmlFor="ask">
            Ask the assistant
          </label>
          <textarea
            id="ask"
            rows={2}
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-muted"
            placeholder="Ask about a course topic, your project, or who to team up with"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(text)
              }
            }}
          />
          <button type="submit" className="btn btn-primary w-10 px-0" aria-label="Ask" disabled={!text.trim() || ask.isPending}>
            <ArrowUp size={16} />
          </button>
        </div>
      </form>
    </div>
  )
}
