-- Demo data for Workmint. Run schema.sql first.
--   psql -U postgres -d workmint -f server/seed.sql
--
-- Every demo account uses the password: demo1234

TRUNCATE payments, withdrawals, payment_methods, messages,
  contracts, proposals, jobs, portfolio_items, users RESTART IDENTITY CASCADE;

INSERT INTO users (name, email, password, role, status, company, title, bio,
                   skills, hourly_rate, rating, location)
VALUES
  -- 1: client
  ('Rana Haddad', 'rana@techcorp.com', 'demo1234', 'client', 'active',
   'TechCorp', 'Head of engineering', NULL, '{}', 0, 4.9, 'Amman, Jordan'),

  -- 2: freelancer
  ('Sadeq Odeh', 'sadeq@workmint.dev', 'demo1234', 'freelancer', 'active',
   NULL, 'Full-stack developer',
   'Builds web applications, REST APIs and the database layer underneath them.',
   '{React.js,Node.js,PostgreSQL,C++}', 45, 4.9, 'Amman, Jordan'),

  -- 3: admin
  ('Workmint Ops', 'ops@workmint.com', 'demo1234', 'admin', 'active',
   NULL, 'Platform operations', NULL, '{}', 0, 5.0, 'Amman, Jordan'),

  -- 4: freelancer
  ('Layla Nasser', 'layla@nasser.dev', 'demo1234', 'freelancer', 'active',
   NULL, 'Data visualisation engineer',
   'Analytics pipelines and the dashboards on top of them.',
   '{Go,PostgreSQL,Grafana}', 52, 4.8, 'Beirut, Lebanon'),

  -- 5: freelancer
  ('Karim Aziz', 'karim@aziz.io', 'demo1234', 'freelancer', 'active',
   NULL, 'DevOps engineer',
   'Pipeline migrations and deployment setup. Leaves documentation behind.',
   '{Docker,Terraform,Go}', 48, 4.7, 'Cairo, Egypt'),

  -- 6: freelancer waiting for admin approval
  ('Yousef Amer', 'yousef.amer@mail.com', 'demo1234', 'freelancer', 'pending',
   NULL, 'Android developer', 'Six years of Android work, mostly logistics apps.',
   '{Kotlin,Firebase}', 40, 5.0, 'Amman, Jordan'),

  -- 7: suspended client
  ('Tom Vale', 'tom@valeworks.com', 'demo1234', 'client', 'suspended',
   'Valeworks', 'Founder', NULL, '{}', 0, 3.2, 'London, UK');

UPDATE users
SET suspended_reason = 'Three chargebacks after the work was approved.'
WHERE email = 'tom@valeworks.com';

INSERT INTO portfolio_items (user_id, title, tech, link, description) VALUES
  (2, 'Employee task tracking system', '{React,Node.js,PostgreSQL}',
   'https://github.com/demo/task-tracker',
   'Role-based access control and reporting for a 200-person team.'),
  (2, 'Zyro browser shell', '{C++,GTK3}',
   'https://github.com/demo/zyro',
   'A multi-process browser shell with request interception.');

INSERT INTO payment_methods (client_id, label, kind) VALUES
  (1, 'Visa ending 4417', 'Card'),
  (1, 'Arab Bank transfer', 'Bank');

INSERT INTO jobs (client_id, title, description, budget, days, level, skills, status) VALUES
  (1, 'Realtime metrics service',
   'Stream our ingestion events into a service that powers the per-second dashboards. The message queue already exists, we need the consumer and the storage layer.',
   4500, 30, 'Expert', '{Go,PostgreSQL}', 'open'),

  (1, 'Internal admin panel rebuild',
   'Replace an ageing internal tool with a React panel. The designs are done, nine screens, and the API already exists.',
   2000, 18, 'Intermediate', '{React.js,Bootstrap}', 'open'),

  (1, 'C++ systems architecture review',
   'Refactor the ingestion pipeline into modular services and document the threading model.',
   3400, 32, 'Expert', '{C++,PostgreSQL}', 'filled'),

  (1, 'Customer analytics dashboard',
   'Usage analytics for the admin console: retention, funnel drop-off and CSV export.',
   3000, 22, 'Intermediate', '{Go,Grafana}', 'filled');

INSERT INTO proposals (job_id, freelancer_id, amount, days, cover, status) VALUES
  (1, 4, 4200, 28,
   'I built the same rollup layer for a metrics product last year. The trap here is late-arriving events breaking the per-second buckets, so I would agree the windowing strategy with you before writing any consumer code.',
   'Pending'),

  (1, 5, 3600, 35,
   'The cheapest path is not a new service. I would run the consumer next to your existing cluster and reuse the PostgreSQL instance you already pay for.',
   'Pending'),

  (2, 2, 1900, 16,
   'Nine screens on an API that already exists is a clean job. I would build the shared table and form components first so the last six screens go quickly.',
   'Pending'),

  (3, 2, 3400, 32, 'I have done this refactor twice before. Handover notes included.', 'Accepted'),

  (4, 4, 3000, 22, 'Retention and funnel charts are my day job. Export included.', 'Accepted');

INSERT INTO contracts (job_id, client_id, freelancer_id, title, brief, amount, deadline,
                       status, delivery_link, delivery_note, created_at, delivered_at, approved_at) VALUES
  -- Delivered and waiting for the client to review
  (3, 1, 2, 'C++ systems architecture review',
   'Refactor the ingestion pipeline into modular services and document the threading model.',
   3400, CURRENT_DATE + 11, 'delivered',
   'https://github.com/demo/ingest-core/pull/14',
   'Worker pool and retry queue are done. Diagrams are in /docs.',
   NOW() - INTERVAL '21 days', NOW() - INTERVAL '30 hours', NULL),

  -- Finished and paid
  (4, 1, 4, 'Customer analytics dashboard',
   'Usage analytics for the admin console: retention, funnel drop-off and CSV export.',
   3000, CURRENT_DATE - 2, 'approved',
   'https://staging.techcorp.dev/analytics',
   'All four charts are live and the CSV export works.',
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days');

INSERT INTO messages (contract_id, sender_role, body, sent_at) VALUES
  (1, 'client', 'Left comments on the pull request, mainly around the retry path.', NOW() - INTERVAL '26 hours'),
  (1, 'freelancer', 'Got it. Moving the backoff into its own class and pulling the config out to env vars.', NOW() - INTERVAL '25 hours'),
  (1, 'client', 'Perfect. Can we talk about a metrics endpoint before handover?', NOW() - INTERVAL '3 hours'),
  (2, 'freelancer', 'Dashboard is on staging. The retention chart needed a different query shape.', NOW() - INTERVAL '6 days'),
  (2, 'client', 'Looks great, approving it now. Thanks Layla.', NOW() - INTERVAL '5 days');

INSERT INTO payments (client_id, method_id, note, amount_usd, currency, rate, amount_converted, paid_at) VALUES
  (1, 1, 'Escrow funding for the analytics dashboard', 3090.00, 'JOD', 0.709000, 2190.81, NOW() - INTERVAL '30 days'),
  (1, 1, 'Escrow funding for the C++ architecture review', 3502.00, 'JOD', 0.709000, 2482.92, NOW() - INTERVAL '21 days');

INSERT INTO withdrawals (freelancer_id, amount, method, status, at) VALUES
  (4, 2700, 'Bank transfer', 'Paid', NOW() - INTERVAL '4 days'),
  (2, 720, 'PayPal', 'Processing', NOW() - INTERVAL '2 days');
