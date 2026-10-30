// Shapes returned by the CampusConnect API (mirrors the backend DTO records).

export type Availability = 'AVAILABLE' | 'LOOKING' | 'BUSY'
export type ProjectStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface UserSummary {
  id: number
  fullName: string
  headline: string | null
  department: string | null
  availability: Availability
  skills: Record<string, number>
}

/** Another student's profile: what anyone signed in may see, without the email address. */
export interface PublicProfile extends UserSummary {
  bio: string | null
  yearOfStudy: number | null
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
}

/** Your own profile: the public part plus your email. */
export interface UserProfile extends PublicProfile {
  email: string
}

export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface ProjectSummary {
  id: number
  title: string
  category: string
  status: ProjectStatus
  maxMembers: number
  memberCount: number
  skills: string[]
  ownerId: number
  ownerName: string
  createdAt: string
}

export interface Member {
  userId: number
  fullName: string
  headline: string | null
  role: 'OWNER' | 'MEMBER'
  joinedAt: string
}

export interface ApplicationView {
  id: number
  projectId: number
  projectTitle: string
  userId: number
  userName: string
  kind: 'APPLY' | 'INVITE'
  message: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string
}

export interface ProjectDetail {
  id: number
  title: string
  description: string
  category: string
  status: ProjectStatus
  maxMembers: number
  githubRepo: string | null
  ownerId: number
  skills: string[]
  members: Member[]
  createdAt: string
  myRole: 'OWNER' | 'MEMBER' | null
  myRequest: ApplicationView | null
}

export interface SaveProject {
  title: string
  description: string
  category: string
  status?: ProjectStatus
  maxMembers?: number
  githubRepo?: string | null
  skills: string[]
}

export interface Task {
  id: number
  title: string
  status: TaskStatus
  assigneeId: number | null
  assigneeName: string | null
  createdAt: string
}

export interface ChatMessage {
  id: number
  projectId: number
  senderId: number
  senderName: string
  content: string
  createdAt: string
}

export interface Activity {
  id: number
  projectId: number
  source: string
  summary: string
  url: string | null
  createdAt: string
}

export interface Connection {
  id: number
  user: UserSummary
  status: 'PENDING' | 'ACCEPTED'
  direction: 'INCOMING' | 'OUTGOING'
  createdAt: string
}

export interface Author {
  id: number
  fullName: string
  headline: string | null
}

export interface Post {
  id: number
  title: string
  body: string
  tags: string[]
  upvotes: number
  comments: number
  author: Author
  votedByMe: boolean
  flagged: boolean
  createdAt: string
}

export interface Comment {
  id: number
  postId: number
  author: Author
  body: string
  createdAt: string
}

export interface PostDetail {
  post: Post
  comments: Comment[]
}

export interface Notification {
  id: number
  type: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

export interface ProjectMatch {
  project: ProjectSummary
  score: number
  matchedSkills: string[]
  missingSkills: string[]
}

export interface UserMatch {
  user: UserSummary
  score: number
  matchedSkills: string[]
}

export interface Count {
  label: string
  count: number
}

export interface Dashboard {
  stats: {
    projects: number
    ownedProjects: number
    openTasks: number
    pendingRequests: number
    unreadNotifications: number
    connections: number
    posts: number
    upvotesReceived: number
  }
  tasksByStatus: Count[]
  myTasks: { id: number; title: string; status: TaskStatus; projectId: number; projectTitle: string }[]
  recentActivity: (Activity & { projectTitle: string })[]
  recommended: ProjectMatch[]
  platform: { students: number; openProjects: number; posts: number }
  topSkills: Count[]
  categories: Count[]
}

export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantAnswer {
  answer: string
  sources: { kind: 'POST' | 'PROJECT'; id: number; title: string }[]
}

export interface ResumeSuggestion {
  headline: string | null
  bio: string | null
  department: string | null
  skills: { name: string; level: number }[]
}

export interface ProjectDraft {
  title: string
  description: string
  category: string
  skills: string[]
  tasks: string[]
}
