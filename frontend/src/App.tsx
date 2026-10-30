import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Logo } from './components/ui'
import { useAuth } from './lib/auth'
import { Assistant } from './pages/Assistant'
import { AuthPage } from './pages/AuthPage'
import { Home } from './pages/Home'
import { Inbox } from './pages/Inbox'
import { Knowledge } from './pages/Knowledge'
import { People } from './pages/People'
import { PostPage } from './pages/PostPage'
import { Profile } from './pages/Profile'
import { ProjectDetail } from './pages/ProjectDetail'
import { ProjectForm } from './pages/ProjectForm'
import { Projects } from './pages/Projects'
import { UserPage } from './pages/UserPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="flex min-h-svh items-center justify-center" aria-busy="true">
        <Logo />
      </div>
    )
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-2xl font-semibold">This page doesn't exist</h1>
      <p className="mt-2 text-muted">
        The link may be old, or the project or post was deleted.{' '}
        <Link to="/" className="btn-text">
          Go home
        </Link>
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/edit" element={<ProjectForm />} />
        <Route path="projects/:id/workspace" element={<ProjectDetail initialTab="workspace" />} />
        <Route path="projects/:id/requests" element={<ProjectDetail initialTab="requests" />} />
        <Route path="people" element={<People />} />
        <Route path="network" element={<Navigate to="/people?tab=network" replace />} />
        <Route path="users/:id" element={<UserPage />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="knowledge/:id" element={<PostPage />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
