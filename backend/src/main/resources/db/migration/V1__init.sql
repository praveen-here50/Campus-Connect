-- CampusConnect initial schema.
-- pgvector stores AI embeddings next to the relational data (Supabase ships it).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    headline      VARCHAR(160),
    bio           TEXT,
    department    VARCHAR(120),
    year_of_study SMALLINT,
    github_url    VARCHAR(255),
    linkedin_url  VARCHAR(255),
    availability  VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    embedding     vector(768),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_skills (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill   VARCHAR(60) NOT NULL,
    level   SMALLINT NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
    PRIMARY KEY (user_id, skill)
);

CREATE TABLE connections (
    id           BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

CREATE TABLE projects (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    category    VARCHAR(60) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    max_members SMALLINT NOT NULL DEFAULT 4,
    github_repo VARCHAR(255),
    embedding   vector(768),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_skills (
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill      VARCHAR(60) NOT NULL,
    PRIMARY KEY (project_id, skill)
);

CREATE TABLE project_members (
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- An application (student -> project) or an invite (owner -> student).
CREATE TABLE applications (
    id         BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       VARCHAR(10) NOT NULL DEFAULT 'APPLY',
    message    TEXT,
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

CREATE TABLE tasks (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'TODO',
    assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id         BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_project ON messages(project_id, created_at);

-- Activity feed entries (e.g. GitHub pushes delivered by webhook).
CREATE TABLE project_activity (
    id         BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source     VARCHAR(20) NOT NULL,
    summary    TEXT NOT NULL,
    url        VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE posts (
    id         BIGSERIAL PRIMARY KEY,
    author_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    body       TEXT NOT NULL,
    tags       TEXT[] NOT NULL DEFAULT '{}',
    upvotes    INT NOT NULL DEFAULT 0,
    flagged    BOOLEAN NOT NULL DEFAULT FALSE,
    embedding  vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE post_votes (
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(40) NOT NULL,
    message    TEXT NOT NULL,
    link       VARCHAR(255),
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Approximate nearest-neighbour indexes for semantic search / matching.
CREATE INDEX idx_users_embedding    ON users    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_projects_embedding ON projects USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_posts_embedding    ON posts    USING hnsw (embedding vector_cosine_ops);
