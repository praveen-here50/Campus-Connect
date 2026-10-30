-- A portfolio link next to GitHub and LinkedIn, and an optional profile photo per student.

ALTER TABLE users ADD COLUMN portfolio_url VARCHAR(255);

-- Photos are small (the browser resizes them to 512px before upload), so they live in the database:
-- that works the same locally and on a hosted Postgres, with nothing to configure for files.
CREATE TABLE user_avatars (
    user_id      BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    content_type VARCHAR(40) NOT NULL,
    data         BYTEA       NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
