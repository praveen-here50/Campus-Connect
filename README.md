# CampusConnect

A student collaboration platform: students find teammates by skill, run project teams with a live chat
and a task board, and share what they learn in a searchable knowledge hub. An AI layer matches students
to projects, answers questions from the hub, drafts project listings and reads résumés; n8n handles the
emails and reminders.

## What it does

| Area | Features |
| --- | --- |
| **Profiles & networking** | Skills with levels, availability, résumé (PDF) import, people search by skill, connection requests |
| **Projects** | Listings with required skills and team size, search and filters, apply / invite / accept / decline, leave and remove members |
| **Team workspace** | Task board (to do · building · done), real-time team chat over WebSocket, activity feed, GitHub push and pull-request feed |
| **Knowledge hub** | Questions and write-ups in Markdown, answers, upvotes, tags, keyword search and search by meaning |
| **AI** | Project ↔ student matching (pgvector embeddings + skill overlap), campus assistant grounded in hub posts with sources, project drafting from a rough idea, next-task suggestions, résumé parsing, post moderation |
| **Dashboard & inbox** | Home with today's one fact, counts, matched projects, tasks, team activity and campus skills; inbox of requests and live notifications |
| **Automation (n8n)** | Welcome, application and invitation emails; weekly digest; daily nudge for unanswered applications |

## Tech stack

- **Backend:** Java 21+, Spring Boot 4 (Web MVC, Security with JWT, Data JPA, WebSocket/STOMP, Validation), Flyway, Spring AI 2 (OpenAI-compatible client pointed at Gemini by default), PDFBox
- **Database:** PostgreSQL with **pgvector** (Supabase in production, `pgvector/pgvector` locally)
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, React Router 7, STOMP.js, Lucide icons
- **Automation:** n8n (webhook in, scheduled jobs calling the backend's automation API)

```
frontend (React) ──REST /api──▶ backend (Spring Boot) ──JPA/Flyway──▶ PostgreSQL + pgvector
        ▲   └──STOMP /ws──────────▶   │  │                                   ▲
        │      live chat, activity,   │  └──Spring AI──▶ Gemini (chat + embeddings)
        │      notifications          ├──events (X-Api-Key)──▶ n8n ──▶ email
        │                             ◀──/api/automation/** (X-Api-Key)── n8n schedules
        └────────────── GitHub webhooks ──▶ /api/integrations/github (HMAC-verified)
```

Backend packages: `auth`, `user` (profiles, connections), `project` (projects, members, applications,
tasks), `team` (chat, activity, GitHub), `knowledge` (posts, comments, votes), `notification`,
`dashboard`, `ai` (embeddings, matching, assistant, moderation), `automation`, `common`, `config`.

## Run it locally (Docker, recommended)

Needs Docker Desktop.

```bash
cp backend/.env.example backend/.env      # optional: add AI_API_KEY for the AI features
docker compose up -d --build              # database + API
cd frontend && npm install && npm run dev # the site, with hot reload
```

Open <http://localhost:5173>. The API is on :8080 and PostgreSQL on :5432 (user/password/db: `campusconnect`).
The dev server proxies `/api` and `/ws` to :8080 and must run on 5173, the origin the API allows; if
the port is taken it stops instead of moving to another one (another dev server is probably running).
To run the frontend in Docker instead: `docker compose --profile web up`.

To fill it with demo students, projects, chats and posts (password `campus-demo-1` for every account):

```bash
node scripts/seed-demo.mjs            # prints the email of the main demo student
```

To start n8n as well: `docker compose --profile automation up`, then open <http://localhost:5678>
(see [Automation](#automation-n8n)).

### Without Docker

- **Database:** a PostgreSQL with the `vector` extension, or a Supabase project. Put its connection
  string in `backend/.env` (see `.env.example`).
- **Backend:** `cd backend && ./mvnw spring-boot:run` (JDK matching `java.version` in `pom.xml`).
- **Frontend:** `cd frontend && npm ci && npm run dev`.

> **Windows with Smart App Control on:** Windows blocks the unsigned native binaries Vite, Tailwind and
> oxlint use, so `npm run dev` fails with "An Application Control policy has blocked this file". Run the
> frontend through Docker (`docker compose --profile web up`), or inside WSL. Smart App Control can be switched off in Windows
> Security, but Windows does not let you switch it back on without a reinstall.

## Configuration (`backend/.env`)

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | always | Supabase: Connect → Session pooler, keep `?sslmode=require` |
| `JWT_SECRET` | always | 32+ random characters |
| `AI_API_KEY` | AI features | Google AI Studio key. Without it the app works, AI buttons answer "not configured", matching uses skills only |
| `AI_BASE_URL`, `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL` | optional | Any OpenAI-compatible provider; embeddings must be 768-dimensional |
| `AI_REQUESTS_PER_MINUTE` | optional | Shared limit for LLM calls (default 10, fits the Gemini free tier) |
| `FRONTEND_URLS` | always | Comma-separated allowed origins for CORS and WebSocket |
| `N8N_WEBHOOK_URL` | automation | e.g. `http://localhost:5678/webhook/campusconnect` |
| `AUTOMATION_API_KEY` | automation | Shared secret between the backend and n8n (`X-Api-Key`) |
| `GITHUB_WEBHOOK_SECRET` | GitHub feed | The secret you enter in the repository's webhook settings |

Frontend: `VITE_API_URL` (production builds only) is the backend's public URL; in development Vite
proxies `/api` and `/ws`.

## Automation (n8n)

The workflows live in `automation/n8n/`. With the `automation` profile they are mounted at
`/workflows` in the n8n container:

```bash
docker compose --profile automation run --rm n8n import:workflow --separate --input=/workflows
```

Then in n8n:

1. Create a **Header Auth** credential named `CampusConnect API key`: header `X-Api-Key`, value =
   your `AUTOMATION_API_KEY`.
2. Create an **SMTP** credential named `CampusConnect SMTP` (e.g. a Gmail app password, Brevo, Mailtrap).
3. Open each workflow, pick the two credentials in every node that uses one (a credential shown by name
   only is not linked yet), **save it (Ctrl+S)**, then activate it. Imported workflows have no saved
   version until their first save in the editor, and n8n refuses to activate them before that. Import each
   file once: importing again creates duplicates.
4. Set `N8N_WEBHOOK_URL=http://n8n:5678/webhook/campusconnect` (inside Docker) and the same
   `AUTOMATION_API_KEY` for the backend, then restart it.

| Workflow | Trigger | Does |
| --- | --- | --- |
| Event emails | `POST /webhook/campusconnect` from the backend | Welcome email on sign-up, email the owner on a new application, email a student on an invitation |
| Weekly digest | Mondays 09:00 | `GET /api/automation/weekly-digest`, email each student their invites, tasks and new matching projects, then leave an in-app note |
| Unanswered applications | Daily 18:00 | `GET /api/automation/stale-applications?days=3`, nudge the owner by email |

## GitHub activity feed

Owners add the repository (`owner/repo`) to the project. In the GitHub repository: Settings → Webhooks →
Add webhook, payload URL `https://<your-backend>/api/integrations/github`, content type
`application/json`, secret = `GITHUB_WEBHOOK_SECRET`, events "Pushes" and "Pull requests". Every member
then sees pushes and pull requests in the workspace's Activity tab and gets a notification.

## API overview

All endpoints except `/api/auth/**`, `/api/integrations/github` and `/api/automation/**` need
`Authorization: Bearer <jwt>`. Errors are RFC 9457 problem details with a readable `detail`.

| | |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Users | `GET/PUT /api/users/me`, `GET /api/users?q=&skill=`, `GET /api/users/{id}` |
| Connections | `GET/POST /api/connections`, `POST /api/connections/{id}/accept`, `DELETE /api/connections/{id}` |
| Projects | `GET/POST /api/projects`, `GET /api/projects/mine`, `GET /api/projects/by-user/{id}`, `GET/PUT/DELETE /api/projects/{id}`, `DELETE /api/projects/{id}/members/{userId}` |
| Requests | `POST /api/projects/{id}/applications`, `POST /api/projects/{id}/invites`, `GET /api/projects/{id}/applications`, `GET /api/applications/mine`, `GET /api/applications/incoming`, `POST /api/applications/{id}/accept\|reject`, `DELETE /api/applications/{id}` |
| Tasks | `GET/POST /api/projects/{id}/tasks`, `PUT/DELETE /api/tasks/{id}` |
| Team | `GET/POST /api/projects/{id}/messages`, `GET /api/projects/{id}/activity`; STOMP: send `/app/projects/{id}/chat`, subscribe `/topic/projects/{id}/chat`, `/topic/projects/{id}/activity`, `/user/queue/notifications` |
| Knowledge | `GET/POST /api/posts`, `GET /api/posts/semantic?q=`, `GET /api/posts/tags`, `GET/DELETE /api/posts/{id}`, `POST /api/posts/{id}/vote`, `POST /api/posts/{id}/comments`, `DELETE /api/comments/{id}` |
| Notifications | `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` |
| AI | `GET /api/ai/status`, `GET /api/ai/recommendations/projects`, `GET /api/ai/recommendations/projects/{id}/teammates`, `POST /api/ai/assistant`, `POST /api/ai/resume` (multipart `file`), `POST /api/ai/project-draft`, `POST /api/ai/projects/{id}/task-suggestions` |
| Dashboard | `GET /api/dashboard` |
| Automation | `GET /api/automation/weekly-digest`, `GET /api/automation/stale-applications?days=`, `POST /api/automation/notifications` (header `X-Api-Key`) |

## Deploying (free tiers)

- **Database:** Supabase (pgvector is built in; Flyway creates the schema on first start).
- **Backend:** any Docker host, e.g. Render or Railway, from `backend/Dockerfile`. Set the variables
  above, with `FRONTEND_URLS` = the frontend's URL.
- **Frontend:** Vercel or Netlify: build `npm run build`, output `dist`, set `VITE_API_URL`, and add an
  SPA rewrite of all paths to `/index.html`.
- **n8n:** n8n Cloud or a small Docker host; set `CAMPUSCONNECT_WEB` to the deployed site and change
  `http://backend:8080` in the three HTTP Request nodes to the deployed API. (The URLs are plain text
  because the n8n editor cannot read environment variables and refuses to activate a workflow whose URL
  it cannot resolve.)

## Design

The interface follows an "editorial greeting" app style dealt by the taste skill
(`.claude/skills/design-taste-frontend`, seed 232785751): Instrument Sans with an Instrument Serif greeting,
tonal panels without shadows, near-black pill buttons, and one teal accent kept for data (match scores,
open seats, your own skills). The product's own element is the **seat strip**: a team drawn as its
seats, filled by members and dashed where a seat is still open. Light and dark themes follow the system,
with a toggle in the sidebar.
