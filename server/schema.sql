DROP TABLE IF EXISTS disputes, change_requests, activity, messages,
  milestones, orders, proposals, jobs, payment_methods,
  withdrawals, portfolio_items, users CASCADE;

CREATE TABLE users (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  password         TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('client', 'freelancer', 'admin')),
  status           TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'pending', 'suspended')),
  company          TEXT,
  title            TEXT,
  bio              TEXT,
  skills           TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate      NUMERIC(8,2),
  available        BOOLEAN NOT NULL DEFAULT TRUE,
  response_hours   INTEGER DEFAULT 4,
  languages        TEXT,
  portfolio_url    TEXT,
  pitch            TEXT,
  rating           NUMERIC(2,1) DEFAULT 5.0,
  location         TEXT,
  timezone         TEXT,
  suspended_reason TEXT,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE portfolio_items (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  tech        TEXT[] NOT NULL DEFAULT '{}',
  link        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE jobs (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  budget      NUMERIC(12,2) NOT NULL,
  days        INTEGER NOT NULL,
  level       TEXT NOT NULL DEFAULT 'Intermediate'
                   CHECK (level IN ('Entry', 'Intermediate', 'Expert')),
  skills      TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'filled', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE proposals (
  id            SERIAL PRIMARY KEY,
  job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  days          INTEGER NOT NULL,
  cover         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending', 'Interviewing', 'Accepted', 'Declined', 'Withdrawn')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id                 SERIAL PRIMARY KEY,
  job_id             INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  client_id          INTEGER NOT NULL REFERENCES users(id),
  freelancer_id      INTEGER NOT NULL REFERENCES users(id),
  project            TEXT NOT NULL,
  brief              TEXT,
  started_on         DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline           DATE NOT NULL,
  revisions_included INTEGER NOT NULL DEFAULT 2,
  cancelled          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE milestones (
  id               SERIAL PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  title            TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  due_date         DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','submitted','revision','approved','disputed','refunded')),
  revisions_used   INTEGER NOT NULL DEFAULT 0,
  revision_note    TEXT,
  deliverable_link TEXT,
  deliverable_note TEXT,
  delivered_at     TIMESTAMPTZ,
  approved_on      TIMESTAMPTZ,
  refunded_on      TIMESTAMPTZ
);

CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'freelancer')),
  body        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity (
  id       SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor    TEXT NOT NULL CHECK (actor IN ('client', 'freelancer', 'system')),
  text     TEXT NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE change_requests (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  extra_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_days INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'Pending'
                  CHECK (status IN ('Pending', 'Approved', 'Declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE disputes (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  milestone_id    INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  raised_by       TEXT NOT NULL CHECK (raised_by IN ('client', 'freelancer')),
  amount          NUMERIC(12,2) NOT NULL,
  reason          TEXT NOT NULL,
  detail          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Open'
                       CHECK (status IN ('Open', 'Under review', 'Resolved')),
  resolution      TEXT CHECK (resolution IN ('release', 'refund', 'split')),
  resolution_note TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE withdrawals (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  method        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Processing'
                     CHECK (status IN ('Processing', 'Paid', 'Failed')),
  at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_methods (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('Card', 'Bank', 'PayPal')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);
