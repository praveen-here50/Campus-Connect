import { Fragment, type ReactNode } from 'react'
import { Sep } from '../components/ui'

/** Joins the non-empty parts of a meta line with Sep; null when nothing is left. */
export function meta(parts: ReactNode[]): ReactNode {
  const shown = parts.filter(Boolean)
  if (shown.length === 0) return null
  return shown.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <Sep />}
      {p}
    </Fragment>
  ))
}
