// Fills a local CampusConnect with believable demo data through the public API.
//   node scripts/seed-demo.mjs [http://localhost:8080]
// Every account's password is "campus-demo-1". Prints the sign-in email of the main demo student.
// Re-running adds a second, separate set (emails carry a run suffix). Never run it against production.

const B = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '')
const RUN = Date.now().toString(36).slice(-4)
const PASSWORD = 'campus-demo-1'

async function call(method, path, token, body) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(B + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text}`)
  return text ? JSON.parse(text) : undefined
}

const STUDENTS = [
  { key: 'kavya', name: 'Kavya', headline: 'Third-year CS · web and data', department: 'Computer Science', year: 3, availability: 'AVAILABLE', skills: { react: 4, typescript: 4, python: 3, postgres: 3, figma: 2 }, bio: 'I like building tools people on campus actually use. Last semester I made the timetable clash checker for our department.' },
  { key: 'kugan', name: 'Kugan', headline: 'Embedded systems and IoT', department: 'Electronics', year: 2, availability: 'LOOKING', skills: { esp32: 5, 'c++': 4, python: 3, pcb: 3 } },
  { key: 'nila', name: 'Nila', headline: 'ML research assistant', department: 'Data Science', year: 4, availability: 'BUSY', skills: { python: 5, pytorch: 4, statistics: 4, sql: 3 } },
  { key: 'yazhini', name: 'Yazhini', headline: 'Product design · accessibility', department: 'Design', year: 3, availability: 'LOOKING', skills: { figma: 5, 'user research': 4, css: 3 } },
  { key: 'ramesh', name: 'Ramesh', headline: 'Backend in Java and Go', department: 'Computer Science', year: 3, availability: 'AVAILABLE', skills: { java: 5, 'spring boot': 4, postgres: 4, docker: 3, go: 2 } },
  { key: 'thenmozhi', name: 'Thenmozhi', headline: 'Android and Flutter', department: 'Information Technology', year: 2, availability: 'LOOKING', skills: { flutter: 4, kotlin: 3, firebase: 3 } },
  { key: 'senthil', name: 'Senthil', headline: 'Game dev club lead', department: 'Computer Science', year: 4, availability: 'AVAILABLE', skills: { unity: 5, 'c#': 4, blender: 3 } },
  { key: 'malar', name: 'Malar', headline: 'Data viz and civic tech', department: 'Economics', year: 3, availability: 'AVAILABLE', skills: { python: 4, d3: 3, sql: 4, statistics: 3 } },
  { key: 'arivu', name: 'Arivu', headline: 'First-year, learning web dev', department: 'Computer Science', year: 1, availability: 'LOOKING', skills: { html: 3, css: 3, javascript: 2 } },
]

// The main student signs in as the public demo account; on a later run (the address is taken) she gets a
// run-suffixed address like everyone else.
const DEMO_EMAIL = 'demo@demo.campus.edu'

async function registerStudent(s) {
  if (s.key === 'kavya') {
    try {
      const res = await call('POST', '/api/auth/register', null, { email: DEMO_EMAIL, password: PASSWORD, fullName: s.name })
      return { res, email: DEMO_EMAIL }
    } catch (e) {
      if (!/-> 409/.test(e.message)) throw e
    }
  }
  const email = `${s.key}.${RUN}@demo.campus.edu`
  return { res: await call('POST', '/api/auth/register', null, { email, password: PASSWORD, fullName: s.name }), email }
}

const accounts = {}
for (const s of STUDENTS) {
  const { res, email } = await registerStudent(s)
  if (s.key === 'kavya') accounts.mainEmail = email
  const u = await call('PUT', '/api/users/me', res.token, {
    fullName: s.name, headline: s.headline, bio: s.bio ?? null, department: s.department, yearOfStudy: s.year,
    availability: s.availability, skills: s.skills, githubUrl: null, linkedinUrl: null,
  })
  accounts[s.key] = { token: res.token, id: u.id }
}
const T = (k) => accounts[k].token
const ID = (k) => accounts[k].id

async function project(owner, p, members = [], tasks = []) {
  const created = await call('POST', '/api/projects', T(owner), p)
  for (const m of members) {
    const app = await call('POST', `/api/projects/${created.id}/applications`, T(m), { message: 'Count me in.' })
    await call('POST', `/api/applications/${app.id}/accept`, T(owner))
  }
  for (const [title, status, who] of tasks) {
    const t = await call('POST', `/api/projects/${created.id}/tasks`, T(owner), { title, assigneeId: who ? ID(who) : null })
    if (status !== 'TODO') await call('PUT', `/api/tasks/${t.id}`, T(owner), { title, status, assigneeId: who ? ID(who) : null })
  }
  return created.id
}

const docks = await project(
  'kavya',
  {
    title: 'Bike-share dock tracker',
    description: 'Campus has 14 bike docks and nobody knows which ones are empty. We are putting an ESP32 sensor on each dock and building a live map students can check before walking over.\n\n- Sensor firmware and enclosure\n- A small API that stores dock readings\n- A web map with live counts',
    category: 'Hardware/IoT', maxMembers: 4, skills: ['esp32', 'react', 'postgres', 'pcb'], githubRepo: null,
  },
  ['kugan'],
  [
    ['Prototype the reed-switch sensor on one dock', 'DONE', 'kugan'],
    ['Design the readings table and API', 'IN_PROGRESS', 'kavya'],
    ['Draw the map screen in Figma', 'TODO', null],
    ['Weatherproof enclosure for the sensor', 'TODO', 'kugan'],
  ],
)
await project(
  'ramesh',
  {
    title: 'Library study-room finder',
    description: 'Shows which study rooms in the main library are free right now, using the booking system export, with a reminder 10 minutes before your slot ends.',
    category: 'Web', maxMembers: 4, skills: ['java', 'spring boot', 'react', 'typescript'],
  },
  ['kavya'],
  [
    ['Parse the booking export every 5 minutes', 'IN_PROGRESS', 'ramesh'],
    ['Room list with free/busy state', 'TODO', 'kavya'],
  ],
)
await project('nila', { title: 'Mess menu waste predictor', description: 'Predict how many plates each mess dish will need from past attendance, to cut food waste. Needs someone for a simple dashboard.', category: 'AI/ML', maxMembers: 3, skills: ['python', 'statistics', 'react'] }, ['malar'])
await project('yazhini', { title: 'Accessible campus map', description: 'A map of step-free routes, lifts and accessible toilets across campus, checked on foot by volunteers.', category: 'Design', maxMembers: 5, skills: ['figma', 'user research', 'react', 'typescript'] })
await project('senthil', { title: 'Fest escape-room game', description: 'A short Unity escape room themed on the campus clock tower, for the cultural fest in March.', category: 'Game', maxMembers: 4, skills: ['unity', 'c#', 'blender'] }, ['arivu'])
await project('thenmozhi', { title: 'Hostel laundry queue app', description: 'Join a queue for the hostel washing machines and get a push notification when it is your turn.', category: 'Mobile', maxMembers: 3, skills: ['flutter', 'firebase', 'kotlin'] })

// Pending requests waiting on Kavya: an application to her project and an invitation to Yazhini's.
await call('POST', `/api/projects/${docks}/applications`, T('arivu'), { message: 'I am new to hardware but I can build the web map, and I would love to learn the sensor side.' })

// Team chat on the dock tracker.
for (const [who, text] of [
  ['kavya', 'Readings table is up on the dev database. Kugan, what interval are you sending at?'],
  ['kugan', 'Every 30 s for now, plus an event when a bike docks or leaves.'],
  ['kavya', 'Perfect, I will add an index on (dock_id, read_at).'],
]) await call('POST', `/api/projects/${docks}/messages`, T(who), { content: text })

// Knowledge hub.
const post1 = await call('POST', '/api/posts', T('kugan'), { title: 'How do I debounce a reed switch on an ESP32?', body: 'My dock sensor reports 3-4 events every time a bike docks. Hardware or software fix?', tags: ['esp32', 'hardware'] })
await call('POST', `/api/posts/${post1.post.id}/comments`, T('ramesh'), { body: 'Do both: a 100 nF capacitor across the switch, then ignore changes for 50 ms in software.' })
const post2 = await call('POST', '/api/posts', T('nila'), { title: 'Free GPU options for course projects?', body: 'Colab keeps disconnecting on long runs. What do people use for 2-3 hour training jobs?', tags: ['machine-learning', 'python'] })
await call('POST', `/api/posts/${post2.post.id}/comments`, T('malar'), { body: 'Kaggle notebooks give you 30 GPU hours a week and do not time out as fast.' })
const post3 = await call('POST', '/api/posts', T('ramesh'), { title: 'Spring Boot on a free host: what worked for me', body: 'Render free tier + Supabase Postgres. Cold starts are ~40 s, so ping it before demos.\n\n```\n./mvnw package -DskipTests\n```', tags: ['spring-boot', 'deployment', 'java'] })
for (const k of ['kavya', 'kugan', 'nila', 'thenmozhi']) await call('POST', `/api/posts/${post3.post.id}/vote`, T(k))
for (const k of ['kavya', 'ramesh']) await call('POST', `/api/posts/${post1.post.id}/vote`, T(k))
await call('POST', `/api/posts/${post2.post.id}/vote`, T('kavya'))

// Connections.
await call('POST', '/api/connections', T('kavya'), { userId: ID('ramesh') })
await call('POST', '/api/connections', T('ramesh'), { userId: ID('kavya') })
await call('POST', '/api/connections', T('kavya'), { userId: ID('kugan') })
await call('POST', '/api/connections', T('kugan'), { userId: ID('kavya') })
await call('POST', '/api/connections', T('yazhini'), { userId: ID('kavya') })

console.log(JSON.stringify({ email: accounts.mainEmail, password: PASSWORD, token: T('kavya') }))
