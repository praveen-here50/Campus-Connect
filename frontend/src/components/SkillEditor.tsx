import { X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { LEVEL_LABEL } from '../lib/format'

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

function useAdder(onAdd: (skill: string) => void) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    draft
      .split(',')
      .map(norm)
      .filter(Boolean)
      .forEach(onAdd)
    setDraft('')
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
  }
  return { draft, setDraft, commit, onKeyDown }
}

/** A list of skill names (what a project needs). */
export function SkillList({ id, value, onChange, max = 20 }: { id: string; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const adder = useAdder((s) => {
    if (!value.includes(s) && value.length < max) onChange([...value, s])
  })
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((s) => (
          <span key={s} className="pill">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange(value.filter((x) => x !== s))}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        id={id}
        className="field mt-2"
        placeholder={value.length >= max ? `Up to ${max} skills` : 'Type a skill and press Enter'}
        disabled={value.length >= max}
        value={adder.draft}
        onChange={(e) => adder.setDraft(e.target.value)}
        onKeyDown={adder.onKeyDown}
        onBlur={adder.commit}
      />
    </div>
  )
}

/** Skills with a level 1-5 (what a student can do). */
export function SkillLevels({ id, value, onChange, max = 30 }: { id: string; value: Record<string, number>; onChange: (v: Record<string, number>) => void; max?: number }) {
  const names = Object.keys(value)
  const adder = useAdder((s) => {
    if (!(s in value) && names.length < max) onChange({ ...value, [s]: 3 })
  })
  return (
    <div>
      {names.length > 0 && (
        <ul className="mb-2 flex flex-col">
          {names.map((s) => (
            <li key={s} className="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-0">
              <span className="min-w-0 truncate font-medium">{s}</span>
              <span className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`${id}-${s}`}>
                  Level for {s}
                </label>
                <select
                  id={`${id}-${s}`}
                  className="field !h-8 w-auto text-[13px]"
                  value={value[s]}
                  onChange={(e) => onChange({ ...value, [s]: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABEL[l]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="p-1 text-muted hover:text-ink"
                  aria-label={`Remove ${s}`}
                  onClick={() => {
                    const next = { ...value }
                    delete next[s]
                    onChange(next)
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="field"
        placeholder="Add a skill, e.g. react, figma, statistics"
        value={adder.draft}
        onChange={(e) => adder.setDraft(e.target.value)}
        onKeyDown={adder.onKeyDown}
        onBlur={adder.commit}
      />
    </div>
  )
}
