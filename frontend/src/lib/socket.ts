import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { useEffect, useRef } from 'react'
import { API_URL, getToken } from './api'

// One shared STOMP connection for the whole app. Subscriptions made before the socket
// connects are queued, and every subscription is restored after a reconnect.

type Handler = (body: unknown) => void
interface Sub {
  destination: string
  handler: Handler
  stomp?: StompSubscription
}

let client: Client | null = null
const subs = new Set<Sub>()

function socketUrl(): string {
  const base = API_URL || window.location.origin
  return base.replace(/^http/, 'ws') + '/ws'
}

function attach(sub: Sub) {
  if (!client?.connected) return
  sub.stomp = client.subscribe(sub.destination, (msg: IMessage) => {
    try {
      sub.handler(JSON.parse(msg.body))
    } catch {
      // ignore malformed frames
    }
  })
}

export function connectSocket() {
  const token = getToken()
  if (!token || client) return
  client = new Client({
    brokerURL: socketUrl(),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 4000,
    onConnect: () => subs.forEach(attach),
  })
  client.activate()
}

export function disconnectSocket() {
  void client?.deactivate()
  client = null
  subs.forEach((s) => (s.stomp = undefined))
}

export function subscribe(destination: string, handler: Handler): () => void {
  const sub: Sub = { destination, handler }
  subs.add(sub)
  attach(sub)
  return () => {
    subs.delete(sub)
    try {
      sub.stomp?.unsubscribe()
    } catch {
      // socket already closed
    }
  }
}

export function publish(destination: string, body: unknown): boolean {
  if (!client?.connected) return false
  client.publish({ destination, body: JSON.stringify(body) })
  return true
}

/** Subscribes for the component's lifetime; the latest handler is always used. */
export function useSubscription<T>(destination: string | null, handler: (body: T) => void) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!destination) return
    return subscribe(destination, (b) => ref.current(b as T))
  }, [destination])
}
