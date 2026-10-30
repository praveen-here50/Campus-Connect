import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// A small, safe Markdown renderer for posts, comments and assistant answers. It builds React
// elements (never innerHTML) and supports what students actually write: paragraphs, headings,
// lists, fenced code, inline code, bold, italics and links. [Post #12] / [Project #3] become links.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[(?:Post|Project) #\d+\])|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}-${i++}`
    const tok = m[0]
    if (m[1]) out.push(<code key={k} className="rounded bg-active px-1 py-0.5 font-mono text-[0.9em]">{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>)
    else if (m[3]) out.push(<em key={k}>{tok.slice(1, -1)}</em>)
    else if (m[4]) {
      const [, kind, id] = /\[(Post|Project) #(\d+)\]/.exec(tok)!
      out.push(
        <Link key={k} to={kind === 'Post' ? `/knowledge/${id}` : `/projects/${id}`} className="font-medium text-accent">
          {kind} #{id}
        </Link>,
      )
    } else if (m[5]) {
      const label = tok.slice(1, tok.indexOf(']('))
      out.push(
        <a key={k} href={m[6]} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-2">
          {label}
        </a>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${n++}`
    if (line.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded-[12px] bg-active p-3 font-mono text-[13px] leading-5">
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push(
        <p key={key} className="font-semibold">
          {inline(heading[2], key)}
        </p>,
      )
      i++
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''))
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={key} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}-${j}`)}</li>
          ))}
        </Tag>,
      )
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\s*([-*]|\d+\.)\s+)/.test(lines[i])) para.push(lines[i++])
    blocks.push(
      <p key={key}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `${key}-${j}`)}
          </Fragment>
        ))}
      </p>,
    )
  }
  return <div className="space-y-3 leading-6 [overflow-wrap:anywhere]">{blocks}</div>
}
