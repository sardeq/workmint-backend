-- =========================================================================
-- Seed data.  psql -d workmint -f seed.sql
--
-- Every password hash below is bcrypt('demo1234'), so all demo accounts sign
-- in with demo1234. Generate your own with:
--   node -e "console.log(require('bcryptjs').hashSync('demo1234',10))"
-- =========================================================================

TRUNCATE disputes, change_requests, activity, messages,
  milestones, orders, proposal_milestones, proposals, jobs, payment_methods,
  withdrawals, portfolio_items, users RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------- accounts
INSERT INTO users (name, email, password_hash, role, status, company, title, bio,
                   skills, hourly_rate, location, timezone, languages, rating, portfolio_url, pitch)
VALUES
  ('Rana Haddad', 'rana@techcorp.com',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'client', 'active', 'TechCorp', 'Head of engineering', NULL,
   '{}', NULL, 'Amman, Jordan', 'GMT+3', NULL, 4.9, NULL, NULL),

  ('Sadeq Odeh', 'sadeq@workmint.dev',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'freelancer', 'active', NULL, 'Full-stack developer - React & .NET',
   'Builds scalable web applications, REST APIs and the database layer underneath them.',
   '{React.js,.NET,C++,PostgreSQL}', 45, 'Amman, Jordan', 'GMT+3',
   'Arabic (native), English (fluent)', 4.9, NULL, NULL),

  ('Workmint Ops', 'ops@workmint.com',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'admin', 'active', NULL, 'Platform operations', NULL, '{}', NULL, NULL, NULL, NULL, 5.0, NULL, NULL),

  ('Layla Nasser', 'layla@nasser.dev',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'freelancer', 'active', NULL, 'Data visualisation engineer',
   'Analytics pipelines and the dashboards on top of them.',
   '{Go,Kafka,PostgreSQL,Grafana}', 52, 'Beirut, Lebanon', 'GMT+3', 'Arabic, English', 4.8, NULL, NULL),

  ('Karim Aziz', 'karim@aziz.io',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'freelancer', 'active', NULL, 'DevOps and platform engineer',
   'Pipeline migrations and on-call setup. Leaves runbooks behind.',
   '{Kubernetes,Terraform,Go}', 48, 'Cairo, Egypt', 'GMT+2', 'Arabic, English', 4.7, NULL, NULL),

  -- waiting on screening, so the admin approvals queue is not empty
  ('Yousef Amer', 'yousef.amer@mail.com',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'freelancer', 'pending', NULL, 'Android developer', NULL,
   '{Kotlin,"Jetpack Compose",Firebase}', 40, 'Amman, Jordan', 'GMT+3', NULL, 5.0,
   'https://github.com/demo/yousef',
   'Six years of Android work, mostly logistics and field-service apps.'),

  ('Tom Vale', 'tom@valeworks.com',
   '$2b$10$w7MGnCm0lnLE/FWytUxjeOF1J0CwtWr8iKbDxN73qxMQDPZ1T11Je',
   'client', 'suspended', 'Valeworks', 'Founder', NULL, '{}', NULL, NULL, NULL, NULL, 3.2, NULL, NULL);

UPDATE users SET suspended_reason = 'Three chargebacks after milestone approval.'
WHERE email = 'tom@valeworks.com';

-- --------------------------------------------------------------- portfolio
INSERT INTO portfolio_items (user_id, title, tech, link, description) VALUES
  (2, 'Employee task tracking system', '{React,Node.js,PostgreSQL}',
   'https://github.com/demo/task-tracker',
   'Role-based access control, audit trail and analytics for a 200-person team.'),
  (2, 'Zyro browser engine shell', '{C++,CEF3,GTK3}',
   'https://github.com/demo/zyro',
   'Multi-process browser shell with a V8 IPC bridge and request interception.');

-- -------------------------------------------------------------- payment
INSERT INTO payment_methods (client_id, label, kind, is_primary) VALUES
  (1, 'Visa ending 4417', 'Card', TRUE),
  (1, 'Arab Bank transfer', 'Bank', FALSE);

-- ------------------------------------------------------------------ jobs
INSERT INTO jobs (client_id, title, description, budget, days, level, skills, status) VALUES
  (1, 'Realtime metrics service',
   'Stream ingestion events into a rollup service that powers per-second dashboards. Existing Kafka topics, we need the consumer and the storage layer.',
   4500, 30, 'Expert', '{Go,Kafka,PostgreSQL}', 'open'),
  (1, 'Internal admin panel rebuild',
   'Replace an ageing internal tool with a React panel. Designs are done, nine screens, the API already exists.',
   2000, 18, 'Intermediate', '{React.js,Bootstrap,"REST API"}', 'open');

-- ------------------------------------------------------------- proposals
INSERT INTO proposals (job_id, freelancer_id, amount, days, cover, status) VALUES
  (1, 4, 4200, 28,
   'I built the rollup layer for a metrics product doing 40k events/sec on Kafka. The trap here is late-arriving events breaking your per-second buckets, so I would settle the windowing strategy with you before writing the consumer.',
   'Pending'),
  (1, 5, 3600, 35,
   'Cheapest path here is not a new service. I would run the consumer as a sidecar on your existing cluster and reuse the Postgres you already pay for.',
   'Pending');

INSERT INTO proposal_milestones (proposal_id, position, title, amount) VALUES
  (1, 1, 'Consumer + windowing', 1800),
  (1, 2, 'Rollup storage', 1400),
  (1, 3, 'Load test & handover', 1000),
  (2, 1, 'Consumer service', 2000),
  (2, 2, 'Deploy & observability', 1600);

-- ---------------------------------------------------------------- orders
INSERT INTO orders (client_id, freelancer_id, project, brief, started_on, deadline, revisions_included) VALUES
  (1, 2, 'C++ Systems Architecture',
   'Refactor the ingestion pipeline into modular services and document the threading model.',
   CURRENT_DATE - 21, CURRENT_DATE + 11, 3),
  (1, 4, 'Customer Analytics Dashboard',
   'Usage analytics for the admin console: cohort retention, funnel drop-off, CSV export.',
   CURRENT_DATE - 16, CURRENT_DATE + 6, 2);

INSERT INTO milestones (order_id, position, title, amount, due_date, status, revisions_used,
                        revision_note, deliverable_link, deliverable_note, delivered_at, approved_on) VALUES
  (1, 1, 'Architecture & schema', 800, CURRENT_DATE - 9, 'approved', 0, NULL,
   'https://github.com/demo/ingest-arch', 'Diagrams and schema DDL in /docs.',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days'),
  (1, 2, 'Core service refactor', 1200, CURRENT_DATE + 2, 'revision', 1,
   'Worker pool looks good, but the retry logic needs exponential backoff and the config should be env-driven.',
   'https://github.com/demo/ingest-core/pull/14', 'Worker pool + retry queue.',
   NOW() - INTERVAL '30 hours', NULL),
  (1, 3, 'Load testing & handover', 1400, CURRENT_DATE + 11, 'pending', 0, NULL, NULL, NULL, NULL, NULL),

  (2, 1, 'Data model & queries', 900, CURRENT_DATE - 6, 'approved', 0, NULL, NULL, NULL, NULL,
   NOW() - INTERVAL '5 days'),
  (2, 2, 'Dashboard screens', 1100, CURRENT_DATE - 1, 'submitted', 0, NULL,
   'https://staging.techcorp.dev/analytics', 'All four charts live. Export is stubbed until the next milestone.',
   NOW() - INTERVAL '14 hours', NULL),
  (2, 3, 'CSV export & polish', 1000, CURRENT_DATE + 6, 'pending', 0, NULL, NULL, NULL, NULL, NULL);

INSERT INTO messages (order_id, sender_role, body, read, sent_at) VALUES
  (1, 'client', 'Left comments on PR #14 - mainly around the retry path.', TRUE, NOW() - INTERVAL '26 hours'),
  (1, 'freelancer', 'Got it. Moving the backoff into a policy class and pulling the config out to env vars.', TRUE, NOW() - INTERVAL '25 hours'),
  (1, 'client', 'Perfect. Can we talk about adding a metrics endpoint before handover?', FALSE, NOW() - INTERVAL '3 hours'),
  (2, 'freelancer', 'Dashboard screens are on staging. The cohort chart needed a different query shape.', FALSE, NOW() - INTERVAL '14 hours');

INSERT INTO activity (order_id, actor, text, at) VALUES
  (1, 'client', 'TechCorp requested a revision on "Core service refactor"', NOW() - INTERVAL '26 hours'),
  (1, 'freelancer', 'Sadeq Odeh delivered "Core service refactor"', NOW() - INTERVAL '30 hours'),
  (1, 'client', 'TechCorp approved "Architecture & schema" - $800 released', NOW() - INTERVAL '8 days'),
  (2, 'freelancer', 'Layla Nasser delivered "Dashboard screens"', NOW() - INTERVAL '14 hours'),
  (2, 'client', 'TechCorp approved "Data model & queries" - $900 released', NOW() - INTERVAL '5 days');

INSERT INTO change_requests (order_id, reason, extra_cost, extra_days, status, created_at) VALUES
  (2, 'You asked for funnel drop-off by acquisition channel, which needs a second query layer and a new chart type.',
   450, 4, 'Pending', NOW() - INTERVAL '12 hours');

INSERT INTO withdrawals (freelancer_id, amount, method, status, at) VALUES
  (2, 720, 'Bank transfer', 'Paid', NOW() - INTERVAL '20 days');

-- Sanity check: every order's money should add up.
SELECT o.id, o.project, t.total, t.released, t.escrow, t.refunded
FROM orders o JOIN order_totals t ON t.order_id = o.id ORDER BY o.id;