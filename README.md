# Workmint — API Server

REST API for **Workmint**, a freelance marketplace where clients post jobs, freelancers
send proposals, and the money for each project sits in escrow until the client approves
the work milestone by milestone.

---

## Tech stack

| Layer     | Choice                                     |
| --------- | ------------------------------------------ |
| Runtime   | Node.js                                    |
| Framework | Express                                    |
| Database  | PostgreSQL                                 |
| Config    | `dotenv`                                   |
| CORS      | `cors`                                     |

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

# 3. create the tables, then fill them with data
psql -d workmint-db -f server/schema.sql
psql -d workmint-db -f server/seed.sql

# 4. configure the connection (see below)
cp .env.example .env    # then edit it

# 5. run it
npm run dev             # restarts on file changes
npm start               # plain run
```

The server prints `Connected to PostgreSQL` and `Listening on PORT 5000` when it is up.
Visit <http://localhost:5000/> for a health message.

### Environment variables

Create a `.env` file in the project root:

| Variable       | Example                                              | Notes                        |
| -------------- | ---------------------------------------------------- | ---------------------------- |
| `DATABASE_URL` | `postgres://user@/workmint-db?host=/run/postgresql`  | Any valid libpq URL          |
| `PORT`         | `5000`                                               | Defaults to 5000 if not set  |

A TCP connection string works just as well:

```
DATABASE_URL=postgres://user:password@localhost:5432/workmint-db
```

`.env` is ignored by git — never commit real credentials.

---

## Project structure

```
server/
├── index.js            
├── helpers.js       
├── schema.sql       
├── seed.sql           
├── db/
│   └── db.js        
└── routes/
    ├── users.js     
    ├── jobs.js         
    ├── proposals.js        
    ├── orders.js        
    ├── milestones.js     
    ├── messages.js       
    ├── disputes.js        
    ├── portfolio.js       
    ├── withdrawals.js      
    └── paymentMethods.js 
```

---

## API reference

Base URL: `http://localhost:5000/api`

### Users

| Method   | Endpoint            | Purpose                                   |
| -------- | ------------------- | ----------------------------------------- |
| `GET`    | `/users`            | List; optional `?role=` and `?status=`    |
| `GET`    | `/users/:id`        | One account                               |
| `POST`   | `/users`            | Register                                  |
| `POST`   | `/users/login`      | Sign in                                   |
| `PUT`    | `/users/:id`        | Edit profile                              |
| `PUT`    | `/users/:id/status` | Admin: approve, suspend, reinstate        |
| `DELETE` | `/users/:id`        | Remove an account                         |

### Jobs

| Method   | Endpoint     | Purpose                                        |
| -------- | ------------ | ---------------------------------------------- |
| `GET`    | `/jobs`      | List; optional `?client_id=` and `?status=`    |
| `GET`    | `/jobs/:id`  | One listing                                    |
| `POST`   | `/jobs`      | Post a job                                     |
| `PUT`    | `/jobs/:id`  | Edit a job                                     |
| `DELETE` | `/jobs/:id`  | Close it and decline its pending proposals     |

### Proposals

| Method   | Endpoint               | Purpose                                                |
| -------- | ---------------------- | ------------------------------------------------------ |
| `GET`    | `/proposals`           | Filter by `?freelancer_id=`, `?client_id=`, `?job_id=` |
| `POST`   | `/proposals`           | Apply to a job                                         |
| `PUT`    | `/proposals/:id`       | Change status (decline, withdraw…)                     |
| `POST`   | `/proposals/:id/accept`| Hire: creates the order and its milestones             |
| `DELETE` | `/proposals/:id`       | Delete                                                 |

### Orders

| Method   | Endpoint                                  | Purpose                                     |
| -------- | ----------------------------------------- | ------------------------------------------- |
| `GET`    | `/orders`                                 | Filter by `?client_id=` or `?freelancer_id=`|
| `GET`    | `/orders/:id`                             | One order **with** milestones, messages, activity and change requests |
| `POST`   | `/orders`                                 | Create directly (mainly for testing)        |
| `PUT`    | `/orders/:id`                             | Edit                                        |
| `DELETE` | `/orders/:id`                             | Delete                                      |
| `POST`   | `/orders/:id/change-requests`             | Freelancer asks for extra scope             |
| `PUT`    | `/orders/:orderId/change-requests/:id`    | Client approves or declines it              |

### Milestones

| Method   | Endpoint                    | Purpose                              |
| -------- | --------------------------- | ------------------------------------ |
| `GET`    | `/milestones?order_id=1`    | List for one order                   |
| `POST`   | `/milestones`               | Add one                              |
| `PUT`    | `/milestones/:id/start`     | Freelancer starts work               |
| `PUT`    | `/milestones/:id/deliver`   | Freelancer submits a deliverable     |
| `PUT`    | `/milestones/:id/approve`   | Client approves — releases the money |
| `PUT`    | `/milestones/:id/revision`  | Client sends it back with notes      |
| `PUT`    | `/milestones/:id`           | Edit title / amount / due date       |
| `DELETE` | `/milestones/:id`           | Delete                               |

### Messages, disputes and money

| Method   | Endpoint                        | Purpose                                    |
| -------- | ------------------------------- | ------------------------------------------ |
| `GET`    | `/messages?order_id=1`          | The thread for one order                   |
| `POST`   | `/messages`                     | Send a message                             |
| `PUT`    | `/messages/read`                | Mark the other side's messages as read     |
| `GET`    | `/disputes`                     | List; optional `?status=`                  |
| `POST`   | `/disputes`                     | Raise one against a milestone              |
| `PUT`    | `/disputes/:id`                 | Admin claims the case                      |
| `PUT`    | `/disputes/:id/resolve`         | Resolve: `release`, `refund` or `split`    |
| `GET`    | `/portfolio?user_id=2`          | A freelancer's projects                    |
| `POST`   | `/portfolio`                    | Add one                                    |
| `PUT`    | `/portfolio/:id`                | Edit                                       |
| `DELETE` | `/portfolio/:id`                | Remove                                     |
| `GET`    | `/withdrawals?freelancer_id=2`  | Payout history                             |
| `POST`   | `/withdrawals`                  | Request a payout (checks the balance)      |
| `GET`    | `/payment-methods?client_id=1`  | A client's saved methods                   |
| `POST`   | `/payment-methods`              | Add one                                    |
| `PUT`    | `/payment-methods/:id/primary`  | Make it the primary method                 |
| `DELETE` | `/payment-methods/:id`          | Remove                                     |

---
