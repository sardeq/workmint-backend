# Workmint — API Server

REST API for **Workmint**, a freelance marketplace where clients post jobs, freelancers
send proposals, and the money for each contract sits in escrow until the client approves
the delivered work.

The React front end lives in a separate repository and talks to this API over HTTP.

---

## Tech stack

| Layer       | Choice     |
| ----------- | ---------- |
| Runtime     | Node.js    |
| Framework   | Express    |
| Database    | PostgreSQL |
| Config      | `dotenv`   |
| CORS        | `cors`     |

---

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer, running locally
- `psql` on your `PATH`

---

## Getting started

```bash
# 1. install dependencies
npm install

# 2. create the database
createdb workmint-db

# 3. create the tables, then fill them with demo data
psql -d workmint-db -f server/schema.sql
psql -d workmint-db -f server/seed.sql

# 4. configure the connection
cp .env.example .env    # then edit it

# 5. run it
npm run dev             # nodemon, restarts on file changes
npm start               # plain run
```

The server prints `Connected to PostgreSQL` and `Server running on http://localhost:5000`

### Environment variables

Create a `.env` file in the project root:

| Variable       | Example                                             | Notes                       |
| -------------- | --------------------------------------------------- | --------------------------- |
| `DATABASE_URL` | `postgres://user:password@localhost:5432/workmint-db` | Any valid PostgreSQL URL  |
| `PORT`         | `5000`                                              | Defaults to 5000 if not set |


---

## Project structure

```
server/
├── index.js  
├── schema.sql
├── seed.sql  
├── db/
│   └── db.js 
├── middleware/
│   └── adminOnly.js
└── routes/
    ├── users.js 
    ├── portfolio.js 
    ├── jobs.js        
    ├── proposals.js  
    ├── contracts.js     
    ├── messages.js     
    ├── payments.js   
    ├── paymentMethods.js
    └── withdrawals.js
```

Each router owns one table. `index.js` mounts them under a URL prefix, so
`router.get("/")` inside `jobs.js` is served at `/api/jobs`.

---

## Data model

Nine tables. The important relationship is the chain a piece of work travels down:

```
users ──posts──> jobs ──receives──> proposals ──accepted──> contracts ──has──> messages
  │                                                              │
  ├── portfolio_items                                            │
  ├── payment_methods ──used by──> payments                      │
  └── withdrawals <───────────── money released when approved ───┘
```

A **contract** has one price and one status. It moves:

```
in_progress ──deliver──> delivered ──approve──> approved
                             │
                             └──revision──> revision ──deliver──> delivered
```

---

## API reference

Base URL: `http://localhost:5000/api`

### Users

| Method   | Endpoint            | Purpose                                       |
| -------- | ------------------- | --------------------------------------------- |
| `GET`    | `/users`            | Every account. `?role=freelancer` returns only active freelancers |
| `GET`    | `/users/:id`        | One account                                   |
| `POST`   | `/users`            | Register. Freelancers are created as `pending` |
| `POST`   | `/users/login`      | Sign in with email and password                |
| `PUT`    | `/users/:id`        | Edit a profile                                |
| `PUT`    | `/users/:id/status` | **admin** — approve, suspend or reinstate     |
| `DELETE` | `/users/:id`        | **admin** — delete an account                 |

### Portfolio

| Method   | Endpoint                 | Purpose                     |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/portfolio?user_id=2`   | One freelancer's projects   |
| `POST`   | `/portfolio`             | Add a project               |
| `PUT`    | `/portfolio/:id`         | Edit a project              |
| `DELETE` | `/portfolio/:id`         | Remove a project            |

### Jobs

| Method   | Endpoint            | Purpose                                          |
| -------- | ------------------- | ------------------------------------------------ |
| `GET`    | `/jobs`             | Open listings. `?client_id=1` narrows it to one client |
| `GET`    | `/jobs/:id`         | One listing                                      |
| `POST`   | `/jobs`             | Post a job                                       |
| `PUT`    | `/jobs/:id/close`   | Take it down and decline the open bids           |
| `DELETE` | `/jobs/:id`         | **admin** — delete the listing and its proposals |

### Proposals

| Method | Endpoint                 | Purpose                                              |
| ------ | ------------------------ | ---------------------------------------------------- |
| `GET`  | `/proposals`             | All. `?freelancer_id=` or `?client_id=` narrows it   |
| `POST` | `/proposals`             | Apply to a job (one bid per freelancer per job)      |
| `PUT`  | `/proposals/:id`         | Decline it, or withdraw it                           |
| `POST` | `/proposals/:id/accept`  | Hire: creates the contract and settles the other bids |

### Contracts

| Method | Endpoint                   | Purpose                                             |
| ------ | -------------------------- | --------------------------------------------------- |
| `GET`  | `/contracts`               | All. `?client_id=` or `?freelancer_id=` narrows it  |
| `GET`  | `/contracts/:id`           | One contract **with** its messages                  |
| `PUT`  | `/contracts/:id/deliver`   | Freelancer hands the work in (`{ link, note }`)     |
| `PUT`  | `/contracts/:id/approve`   | Client accepts it — the escrow is released          |
| `PUT`  | `/contracts/:id/revision`  | Client sends it back (`{ note }`)                   |
| `PUT`  | `/contracts/:id/cancel`    | Client calls the contract off                       |

### Messages

| Method | Endpoint                     | Purpose                    |
| ------ | ---------------------------- | -------------------------- |
| `GET`  | `/messages?contract_id=1`    | The thread for a contract  |
| `POST` | `/messages`                  | Send a message             |

### Money

| Method   | Endpoint                        | Purpose                                    |
| -------- | ------------------------------- | ------------------------------------------ |
| `GET`    | `/payments?client_id=1`         | A client's payment history                 |
| `POST`   | `/payments`                     | Record a payment, with the currency and exchange rate used |
| `GET`    | `/payment-methods?client_id=1`  | Saved cards and accounts                   |
| `POST`   | `/payment-methods`              | Add one                                    |
| `DELETE` | `/payment-methods/:id`          | Remove one                                 |
| `GET`    | `/withdrawals?freelancer_id=2`  | Payout history                             |
| `POST`   | `/withdrawals`                  | Request a payout                           |

---

## Example requests

```bash
# sign in
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rana@techcorp.com","password":"demo1234"}'

# post a job
curl -X POST http://localhost:5000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"client_id":1,"title":"Landing page","description":"One page, responsive.","budget":600,"days":7,"level":"Entry","skills":["React.js"]}'

# an admin-only route without the header -> 403
curl -X DELETE http://localhost:5000/api/users/7

# the same route with it -> 200
curl -X DELETE http://localhost:5000/api/users/7 -H "x-user-role: admin"
```

---

## Demo accounts

`seed.sql` creates these. Every one of them uses the password `demo1234`.

| Email                  | Role       | Notes                          |
| ---------------------- | ---------- | ------------------------------ |
| `rana@techcorp.com`    | client     | has two live contracts         |
| `sadeq@workmint.dev`   | freelancer | one contract awaiting review   |
| `layla@nasser.dev`     | freelancer | one finished contract          |
| `ops@workmint.com`     | admin      | sees every account and listing |