

DROP TABLE IF EXISTS disputes, change_requests, activity, messages,
  milestones, orders, proposal_milestones, proposals, jobs, payment_methods,
  withdrawals, portfolio_items, users CASCADE;
DROP VIEW IF EXISTS order_totals CASCADE;

-- ---------------------------------------------------------------- accounts
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('client', 'freelancer', 'admin')),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'pending', 'suspended')),

  -- client fields
  company         TEXT,

  -- freelancer fields
  title           TEXT,
  bio             TEXT,
  skills          TEXT[]      NOT NULL DEFAULT '{}',
  hourly_rate     NUMERIC(8,2),
  available       BOOLEAN     NOT NULL DEFAULT TRUE,
  response_hours  INTEGER     DEFAULT 4,
  languages       TEXT,
  portfolio_url   TEXT,
  pitch           TEXT,
  rating          NUMERIC(2,1) DEFAULT 5.0,

  location        TEXT,
  timezone        TEXT,
  suspended_reason TEXT,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_role_status_idx ON users (role, status);

CREATE TABLE portfolio_items (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  tech        TEXT[]  NOT NULL DEFAULT '{}',
  link        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------- marketplace
CREATE TABLE jobs (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  budget      NUMERIC(12,2) NOT NULL CHECK (budget > 0),
  days        INTEGER NOT NULL CHECK (days > 0),
  level       TEXT    NOT NULL DEFAULT 'Intermediate'
                      CHECK (level IN ('Entry', 'Intermediate', 'Expert')),
  skills      TEXT[]  NOT NULL DEFAULT '{}',
  status      TEXT    NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'filled', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX jobs_status_idx ON jobs (status, created_at DESC);

CREATE TABLE proposals (
  id            SERIAL PRIMARY KEY,
  job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  days          INTEGER NOT NULL CHECK (days > 0),
  cover         TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Interviewing', 'Accepted', 'Declined', 'Withdrawn')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, freelancer_id)          -- one live bid per job per person
);

CREATE TABLE proposal_milestones (
  id          SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0)
);

-- ----------------------------------------------------------------- orders
CREATE TABLE orders (
  id                 SERIAL PRIMARY KEY,
  job_id             INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  client_id          INTEGER NOT NULL REFERENCES users(id),
  freelancer_id      INTEGER NOT NULL REFERENCES users(id),
  project            TEXT    NOT NULL,
  brief              TEXT,
  started_on         DATE    NOT NULL DEFAULT CURRENT_DATE,
  deadline           DATE    NOT NULL,
  revisions_included INTEGER NOT NULL DEFAULT 2,
  cancelled          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_client_idx     ON orders (client_id);
CREATE INDEX orders_freelancer_idx ON orders (freelancer_id);

-- The state machine the whole product runs on.
CREATE TABLE milestones (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  title           TEXT    NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date        DATE    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','submitted','revision','approved','disputed','refunded')),
  revisions_used  INTEGER NOT NULL DEFAULT 0,
  revision_note   TEXT,
  deliverable_link TEXT,
  deliverable_note TEXT,
  delivered_at    TIMESTAMPTZ,
  approved_on     TIMESTAMPTZ,
  refunded_on     TIMESTAMPTZ
);

CREATE INDEX milestones_order_idx ON milestones (order_id, position);

CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_role TEXT    NOT NULL CHECK (sender_role IN ('client', 'freelancer')),
  body        TEXT    NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,   -- read by the other side
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_order_idx ON messages (order_id, sent_at);

CREATE TABLE activity (
  id       SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor    TEXT    NOT NULL CHECK (actor IN ('client', 'freelancer', 'system')),
  text     TEXT    NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_order_idx ON activity (order_id, at DESC);

CREATE TABLE change_requests (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason     TEXT    NOT NULL,
  extra_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_days INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending', 'Approved', 'Declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE disputes (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  milestone_id    INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  raised_by       TEXT    NOT NULL CHECK (raised_by IN ('client', 'freelancer')),
  amount          NUMERIC(12,2) NOT NULL,
  reason          TEXT    NOT NULL,
  detail          TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'Open'
                          CHECK (status IN ('Open', 'Under review', 'Resolved')),
  resolution      TEXT    CHECK (resolution IN ('release', 'refund', 'split')),
  resolution_note TEXT,
  resolved_by     INTEGER REFERENCES users(id),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX disputes_status_idx ON disputes (status, opened_at);

-- ---------------------------------------------------------------- payments
CREATE TABLE withdrawals (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method        TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'Processing'
                        CHECK (status IN ('Processing', 'Paid', 'Failed')),
  at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Never store card numbers. The label is what the provider gives you back.
CREATE TABLE payment_methods (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  kind       TEXT    NOT NULL CHECK (kind IN ('Card', 'Bank', 'PayPal')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

-- ------------------------------------------------------------------- views
-- Escrow maths in one place, so the API and any report agree.
CREATE VIEW order_totals AS
SELECT
  o.id AS order_id,
  COALESCE(SUM(m.amount), 0)                                                   AS total,
  COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'approved'), 0)              AS released,
  COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'refunded'), 0)              AS refunded,
  COALESCE(SUM(m.amount) FILTER (WHERE m.status NOT IN ('approved','refunded')), 0) AS escrow
FROM orders o
LEFT JOIN milestones m ON m.order_id = o.id
GROUP BY o.id;