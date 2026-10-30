import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Toast {
  id: number
  text: string
  link?: string | null
}

const ToastContext = createContext<(text: string, link?: string | null) => void>(() => {})

/** Quiet, floating confirmations; the only resting surface allowed a shadow. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, link?: string | null) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, link }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto rounded-[14px] bg-primary px-4 py-3 text-on-primary shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            {t.link ? (
              <Link to={t.link} className="underline-offset-2 hover:underline">
                {t.text}
              </Link>
            ) : (
              t.text
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
