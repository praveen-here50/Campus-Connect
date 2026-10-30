import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toasts'
import { Empty, ErrorRow, PageTitle, Panel, Person, Sep, SkeletonRows, StatusPill } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { ago } from '../lib/format'
import type { ApplicationView, Notification } from '../lib/types'

/** Everything that needs the student: requests to answer first, then what happened. */
export function Inbox() {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const incoming = useQuery({ queryKey: ['myApplications', 'incoming'], queryFn: () => api.get<ApplicationView[]>('/api/applications/incoming') })
  const mine = useQuery({ queryKey: ['myApplications', 'mine'], queryFn: () => api.get<ApplicationView[]>('/api/applications/mine') })
  const notes = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<Notification[]>('/api/notifications') })

  const refresh = () => {
    for (const k of ['myApplications', 'notifications', 'unread', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] })
  }
  const decide = useMutation({
    mutationFn: ({ a, accept }: { a: ApplicationView; accept: boolean }) => api.post(`/api/applications/${a.id}/${accept ? 'accept' : 'reject'}`),
    onSuccess: (_, { a, accept }) => {
      toast(accept ? (a.kind === 'INVITE' ? `You joined ${a.projectTitle}.` : `${a.userName} joined ${a.projectTitle}.`) : 'Declined.')
      refresh()
      void qc.invalidateQueries({ queryKey: ['project', a.projectId] })
    },
    onError: (e) => toast(errorMessage(e)),
  })
  const withdraw = useMutation({
    mutationFn: (id: number) => api.del(`/api/applications/${id}`),
    onSuccess: refresh,
    onError: (e) => toast(errorMessage(e)),
  })
  const read = useMutation({ mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`), onSuccess: refresh })
  const readAll = useMutation({ mutationFn: () => api.post('/api/notifications/read-all'), onSuccess: refresh })

  const unread = notes.data?.filter((n) => !n.read).length ?? 0
  const sent = mine.data?.filter((a) => a.kind === 'APPLY') ?? []

  return (
    <div>
      <PageTitle
        title="Inbox"
        sub={
          incoming.data
            ? incoming.data.length
              ? `${incoming.data.length} ${incoming.data.length === 1 ? 'request is' : 'requests are'} waiting on your answer.`
              : 'Nothing is waiting on you.'
            : 'Requests and updates for you.'
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Panel title="Waiting on you" count={incoming.data?.length}>
            {incoming.isLoading ? (
              <SkeletonRows rows={2} height={72} />
            ) : incoming.isError ? (
              <ErrorRow error={incoming.error} retry={() => incoming.refetch()} />
            ) : incoming.data!.length === 0 ? (
              <Empty>No applications or invitations to answer.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {incoming.data!.map((a) => (
                  <li key={a.id} className="row-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {a.kind === 'APPLY' ? (
                        <Person id={a.userId} name={a.userName} sub={<>Asked to join <Link to={`/projects/${a.projectId}`} className="text-ink hover:underline">{a.projectTitle}</Link>
                              <Sep />
                              {ago(a.createdAt)}
                            </>} />
                      ) : (
                        <span className="min-w-0">
                          <Link to={`/projects/${a.projectId}`} className="block truncate font-medium hover:underline">
                            {a.projectTitle}
                          </Link>
                          <span className="block text-[13px] text-muted">Invited you to the team
                            <Sep />
                            {ago(a.createdAt)}</span>
                        </span>
                      )}
                      <span className="flex gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ a, accept: false })}>
                          Decline
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ a, accept: true })}>
                          {a.kind === 'INVITE' ? 'Join' : 'Accept'}
                        </button>
                      </span>
                    </div>
                    {a.message && <p className="mt-2 border-l-2 border-control pl-3 whitespace-pre-line">{a.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Updates"
            count={unread || undefined}
            action={
              unread > 0 && (
                <button type="button" className="btn-text" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
                  Mark all read
                </button>
              )
            }
          >
            {notes.isLoading ? (
              <SkeletonRows rows={4} height={48} />
            ) : notes.isError ? (
              <ErrorRow error={notes.error} retry={() => notes.refetch()} />
            ) : notes.data!.length === 0 ? (
              <Empty>Updates about your projects, posts and connections arrive here.</Empty>
            ) : (
              <ul>
                {notes.data!.map((n) => (
                  <li key={n.id} className="border-b border-rule last:border-0">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 py-3 text-left"
                      onClick={() => {
                        if (!n.read) read.mutate(n.id)
                        if (n.link) navigate(n.link)
                      }}
                    >
                      <span className={`mt-[7px] h-1.5 w-1.5 flex-none rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`} aria-hidden="true" />
                      <span className={`min-w-0 flex-1 ${n.read ? '' : 'font-semibold'}`}>
                        {n.message}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="flex-none text-[13px] text-muted">{ago(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Your applications" count={sent.length || undefined}>
            {mine.isLoading ? (
              <SkeletonRows rows={3} height={48} />
            ) : sent.length === 0 ? (
              <Empty>
                <Link to="/projects?tab=for-you" className="btn-text">
                  Find a project
                </Link>{' '}
                that fits you.
              </Empty>
            ) : (
              <ul>
                {sent.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-rule py-2.5 last:border-0">
                    <span className="min-w-0">
                      <Link to={`/projects/${a.projectId}`} className="block truncate font-medium hover:underline">
                        {a.projectTitle}
                      </Link>
                      <span className="block text-[13px] text-muted">Sent {ago(a.createdAt).toLowerCase()}</span>
                    </span>
                    {a.status === 'PENDING' ? (
                      <button type="button" className="btn-text flex-none text-[13px]" disabled={withdraw.isPending} onClick={() => withdraw.mutate(a.id)}>
                        Withdraw
                      </button>
                    ) : (
                      <StatusPill status={a.status} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
