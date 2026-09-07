-- Workmint database schema (PostgreSQL)
-- Run this file once to create the tables, then run seed.sql to fill them.
--   psql -U postgres -d workmint -f server/schema.sql
--   psql -U postgres -d workmint -f server/seed.sql

DROP TABLE IF EXISTS payments, withdrawals, payment_methods, messages,
  contracts, proposals, jobs, portfolio_items, users CASCADE;

-- Every account on the platform: clients, freelancers and admins.
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
  hourly_rate      NUMERIC(8,2) DEFAULT 0,
  available        BOOLEAN NOT NULL DEFAULT TRUE,
  rating           NUMERIC(2,1) DEFAULT 5.0,
  location         TEXT,
  suspended_reason TEXT,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Past work a freelancer shows on their profile.
CREATE TABLE portfolio_items (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  tech        TEXT[] NOT NULL DEFAULT '{}',
  link        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A job a client posts to the marketplace.
CREATE TABLE jobs (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  budget      NUMERIC(10,2) NOT NULL,
  days        INTEGER NOT NULL,
  level       TEXT NOT NULL DEFAULT 'Intermediate'
                   CHECK (level IN ('Entry', 'Intermediate', 'Expert')),
  skills      TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'filled', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A freelancer's bid on a job.
CREATE TABLE proposals (
  id            SERIAL PRIMARY KEY,
  job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL,
  days          INTEGER NOT NULL,
  cover         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending', 'Accepted', 'Declined', 'Withdrawn')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Created when a client accepts a proposal. One contract has one price and
-- one status, and moves in_progress -> delivered -> approved.
CREATE TABLE contracts (
  id            SERIAL PRIMARY KEY,
  job_id        INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  brief         TEXT,
  amount        NUMERIC(10,2) NOT NULL,
  deadline      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'delivered', 'revision', 'approved', 'cancelled')),
  delivery_link TEXT,
  delivery_note TEXT,
  revision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ
);

-- One chat thread per contract.
CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'freelancer')),
  body        TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A card or account the client pays from.
CREATE TABLE payment_methods (
  id        SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('Card', 'Bank', 'PayPal'))
);

-- A payment the client made. The exchange rate used at the time is stored
-- with the row so the receipt never changes when rates move.
CREATE TABLE payments (
  id               SERIAL PRIMARY KEY,
  client_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_id        INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
  note             TEXT NOT NULL,
  amount_usd       NUMERIC(10,2) NOT NULL,
  currency         TEXT NOT NULL,
  rate             NUMERIC(12,6) NOT NULL,
  amount_converted NUMERIC(12,2) NOT NULL,
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A freelancer moving cleared earnings out of the platform.
CREATE TABLE withdrawals (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL,
  method        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Processing'
                     CHECK (status IN ('Processing', 'Paid', 'Failed')),
  at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
