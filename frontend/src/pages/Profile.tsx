import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, ImageUp, Pencil } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { SkillLevels } from '../components/SkillEditor'
import { useToast } from '../components/Toasts'
import { Avatar, FieldError, PageTitle } from '../components/ui'
import { meta } from '../lib/meta'
import { useAvatarVersions } from '../lib/avatars'
import { api } from '../lib/api'
import { useAuth, useMe } from '../lib/auth'
import { STATUS_LABEL } from '../lib/format'
import type { Availability, ResumeSuggestion, UserProfile } from '../lib/types'

interface Form {
  fullName: string
  headline: string
  bio: string
  department: string
  yearOfStudy: string
  githubUrl: string
  linkedinUrl: string
  portfolioUrl: string
  availability: Availability
  skills: Record<string, number>
}

function toForm(u: UserProfile): Form {
  return {
    fullName: u.fullName,
    headline: u.headline ?? '',
    bio: u.bio ?? '',
    department: u.department ?? '',
    yearOfStudy: u.yearOfStudy ? String(u.yearOfStudy) : '',
    githubUrl: u.githubUrl ?? '',
    linkedinUrl: u.linkedinUrl ?? '',
    portfolioUrl: u.portfolioUrl ?? '',
    availability: u.availability,
    skills: { ...u.skills },
  }
}

/** "github.com/you" becomes "https://github.com/you", so the browser's URL check does not block saving. */
function withScheme(v: string): string {
  const t = v.trim()
  return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t
}

/** Centre-crops the picture to a square and scales it to at most 512px, as a JPEG of a few dozen KB. */
async function squarePhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This file is not a picture the browser can open. Use a JPEG, PNG or WebP.')
  }
  const side = Math.min(bitmap.width, bitmap.height)
  const out = Math.min(512, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the photo'))), 'image/jpeg', 0.88),
  )
}

/** Same profile, ignoring the order skills were added in. */
function sameForm(a: Form, b: Form): boolean {
  const norm = (x: Form) => JSON.stringify({ ...x, skills: Object.entries(x.skills).sort(([p], [q]) => p.localeCompare(q)) })
  return norm(a) === norm(b)
}

function Section({ title, help, aside, children }: { title: string; help: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 border-b border-line py-8 first:pt-0 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-1 text-muted">{help}</p>
        {aside && <div className="mt-4">{aside}</div>}
      </div>
      <div className="panel flex min-w-0 flex-col gap-4 !rounded-2xl !p-4">{children}</div>
    </section>
  )
}

/** How the profile reads in People search: the result of these settings. */
function Preview({ f, id }: { f: Form; id: number }) {
  const skills = Object.entries(f.skills).sort((a, b) => b[1] - a[1])
  return (
    <div data-ui className="rounded-[14px] border border-line bg-raised p-4" aria-label="Preview of your profile in search">
      <p className="mb-3 text-[12px] text-muted">How you appear in People</p>
      <div className="flex items-center gap-3">
        <Avatar id={id} name={f.fullName || '?'} size={40} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{f.fullName || 'Your name'}</span>
          <span className="block truncate text-[13px] text-muted">
            {meta([f.headline, f.department]) ?? STATUS_LABEL[f.availability]}
          </span>
        </span>
      </div>
      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.slice(0, 6).map(([s, l]) => (
            <span key={s} className="pill">
              {s} <span className="num text-muted">{l}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Profile() {
  const me = useMe()
  const { setUser } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState<Form>(() => toForm(me))
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const hasPhoto = !!useAvatarVersions().data?.[me.id]
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = !sameForm(f, toForm(me))

  const resume = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.upload<ResumeSuggestion>('/api/ai/resume', form)
    },
    onSuccess: (s) => {
      setF((x) => ({
        ...x,
        headline: s.headline || x.headline,
        bio: s.bio || x.bio,
        department: s.department || x.department,
        skills: { ...x.skills, ...Object.fromEntries((s.skills ?? []).map((k) => [k.name.toLowerCase(), Math.min(5, Math.max(1, k.level))])) },
      }))
      toast('Filled in from your résumé. Review it, then save.')
    },
  })

  // The photo is saved as soon as it is chosen, apart from the form below.
  const photo = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', await squarePhoto(file), 'photo.jpg')
      return api.upload<{ version: number }>('/api/users/me/avatar', form)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['avatars'] })
      toast('Photo updated.')
    },
  })
  const removePhoto = useMutation({
    mutationFn: () => api.del('/api/users/me/avatar'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['avatars'] })
      toast('Photo removed.')
    },
  })

  const save = useMutation({
    mutationFn: () =>
      api.put<UserProfile>('/api/users/me', {
        fullName: f.fullName,
        headline: f.headline || null,
        bio: f.bio || null,
        department: f.department || null,
        yearOfStudy: f.yearOfStudy ? Number(f.yearOfStudy) : null,
        githubUrl: withScheme(f.githubUrl) || null,
        linkedinUrl: withScheme(f.linkedinUrl) || null,
        portfolioUrl: withScheme(f.portfolioUrl) || null,
        availability: f.availability,
        skills: f.skills,
      }),
    onSuccess: (u) => {
      setUser(u)
      setF(toForm(u))
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['recommendations'] })
      toast('Profile saved. Your matches will update in a moment.')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (dirty) save.mutate()
  }

  // With nothing changed the page offers "Edit profile", which takes you to the first field.
  function startEditing() {
    const name = document.getElementById('fullName')
    name?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    name?.focus({ preventScroll: true })
  }

  const saveButtons = (
    <div className="flex items-center gap-4">
      <button type="button" className="btn-text" disabled={save.isPending} onClick={() => setF(toForm(me))}>
        Discard
      </button>
      <button type="submit" className="btn btn-primary" disabled={save.isPending || !f.fullName.trim()}>
        {save.isPending ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  )

  return (
    <form onSubmit={submit}>
      <PageTitle
        title="Your profile"
        sub={me.email}
        actions={
          dirty ? (
            saveButtons
          ) : (
            <button type="button" className="btn btn-secondary" onClick={startEditing}>
              <Pencil size={15} /> Edit profile
            </button>
          )
        }
      />
      <FieldError error={save.error} />

      <Section title="Photo" help="Shown next to your name across CampusConnect. It is saved as soon as you choose it.">
        <input
          ref={photoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-describedby="photo-rule"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) photo.mutate(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-5">
          <Avatar id={me.id} name={f.fullName || me.fullName} size={72} />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-secondary" disabled={photo.isPending} onClick={() => photoRef.current?.click()}>
                <ImageUp size={15} /> {photo.isPending ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Upload photo'}
              </button>
              {hasPhoto && (
                <button type="button" className="btn-text" disabled={removePhoto.isPending} onClick={() => removePhoto.mutate()}>
                  Remove
                </button>
              )}
            </div>
            <span id="photo-rule" className="text-[13px] text-muted">
              JPEG, PNG or WebP. Cropped to a square.
            </span>
          </div>
        </div>
        <FieldError error={photo.error ?? removePhoto.error} />
      </Section>

      <Section title="Import from your résumé" help="Upload a PDF and the assistant fills in your headline, bio and skills.">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-describedby="resume-rule"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) resume.mutate(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary" disabled={resume.isPending} onClick={() => fileRef.current?.click()}>
            <FileUp size={15} /> {resume.isPending ? 'Reading your résumé…' : 'Choose a PDF'}
          </button>
          <span id="resume-rule" className="text-[13px] text-muted">
            PDF, up to 5 MB.
          </span>
        </div>
        <FieldError error={resume.error} />
      </Section>

      <Section title="About you" help="Your name and headline are what people see first in search and on teams." aside={<Preview f={f} id={me.id} />}>
        <div>
          <label className="field-label" htmlFor="fullName">
            Full name
          </label>
          <input id="fullName" className="field" required maxLength={120} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="headline">
            Headline
          </label>
          <input id="headline" className="field" maxLength={160} placeholder="Second-year CS · backend and data" value={f.headline} onChange={(e) => set('headline', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div>
            <label className="field-label" htmlFor="department">
              Department
            </label>
            <input id="department" className="field" maxLength={120} value={f.department} onChange={(e) => set('department', e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="year">
              Year of study
            </label>
            <select id="year" className="field" value={f.yearOfStudy} onChange={(e) => set('yearOfStudy', e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="bio">
            Bio
          </label>
          <textarea id="bio" className="field" maxLength={2000} value={f.bio} onChange={(e) => set('bio', e.target.value)} />
        </div>
        <fieldset>
          <legend className="field-label">Availability</legend>
          <div className="flex flex-wrap gap-2">
            {(['LOOKING', 'AVAILABLE', 'BUSY'] as Availability[]).map((a) => (
              <label key={a} className={`btn btn-sm cursor-pointer ${f.availability === a ? 'btn-primary' : 'btn-secondary'}`}>
                <input type="radio" name="availability" className="sr-only" checked={f.availability === a} onChange={() => set('availability', a)} />
                {STATUS_LABEL[a]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">“Heads down” hides you from teammate suggestions.</p>
        </fieldset>
      </Section>

      <Section title="Skills" help="Rate yourself honestly: matching compares these with what each project needs.">
        <SkillLevels id="skills" value={f.skills} onChange={(v) => set('skills', v)} />
      </Section>

      <Section title="Links" help="Optional. Shown on your profile page, where people go when they open you from People.">
        <div>
          <label className="field-label" htmlFor="github">
            GitHub
          </label>
          <input id="github" type="url" className="field" maxLength={255} placeholder="https://github.com/you" value={f.githubUrl} onChange={(e) => set('githubUrl', e.target.value)} onBlur={(e) => set('githubUrl', withScheme(e.target.value))} />
        </div>
        <div>
          <label className="field-label" htmlFor="linkedin">
            LinkedIn
          </label>
          <input id="linkedin" type="url" className="field" maxLength={255} placeholder="https://linkedin.com/in/you" value={f.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} onBlur={(e) => set('linkedinUrl', withScheme(e.target.value))} />
        </div>
        <div>
          <label className="field-label" htmlFor="portfolio">
            Portfolio or website
          </label>
          <input id="portfolio" type="url" className="field" maxLength={255} placeholder="https://yourname.dev" value={f.portfolioUrl} onChange={(e) => set('portfolioUrl', e.target.value)} onBlur={(e) => set('portfolioUrl', withScheme(e.target.value))} />
        </div>
      </Section>

      {/* Once something changes, the save stays in reach however far down the page you are. */}
      {dirty && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-ground px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <span className="text-muted">You have unsaved changes</span>
          {saveButtons}
        </div>
      )}
    </form>
  )
}