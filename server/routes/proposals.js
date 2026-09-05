import express from "express";
import pgclient from "../db/db.js";
import { addDays } from "../helpers.js";

const proposalRoutes = express.Router();

// GET http://localhost:5000/api/proposals?freelancer_id=2   (my proposals)
// GET http://localhost:5000/api/proposals?client_id=1        (bids on my jobs)
// GET http://localhost:5000/api/proposals?job_id=1
proposalRoutes.get("/", async (req, res) => {
    const { freelancer_id, client_id, job_id } = req.query;
    try {
        let sql = `SELECT p.*, j.title AS job_title, j.budget AS job_budget,
                          c.company AS client, f.name AS freelancer_name,
                          f.title AS freelancer_title, f.rating, f.skills
                   FROM proposals p
                   JOIN jobs  j ON j.id = p.job_id
                   JOIN users c ON c.id = j.client_id
                   JOIN users f ON f.id = p.freelancer_id
                   WHERE 1 = 1`;
        const values = [];

        if (freelancer_id) {
            values.push(freelancer_id);
            sql = sql + ` AND p.freelancer_id = $${values.length}`;
        }
        if (client_id) {
            values.push(client_id);
            sql = sql + ` AND j.client_id = $${values.length}`;
        }
        if (job_id) {
            values.push(job_id);
            sql = sql + ` AND p.job_id = $${values.length}`;
        }
        sql = sql + " ORDER BY p.sent_at DESC";

        const result = await pgclient.query(sql, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET http://localhost:5000/api/proposals/1
proposalRoutes.get("/:id", async (req, res) => {
    try {
        const result = await pgclient.query("SELECT * FROM proposals WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Proposal not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/proposals
// { "job_id": 1, "freelancer_id": 2, "amount": 4200, "days": 28, "cover": "..." }
proposalRoutes.post("/", async (req, res) => {
    const { job_id, freelancer_id, amount, days, cover } = req.body;

    if (!job_id || !freelancer_id || !amount || !days || !cover) {
        return res.status(400).json({ message: "job_id, freelancer_id, amount, days and cover are required" });
    }

    try {
        const result = await pgclient.query(
            `INSERT INTO proposals (job_id, freelancer_id, amount, days, cover)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [job_id, freelancer_id, amount, days, cover]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ message: "You already applied to this job" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/proposals/1
// { "status": "Declined" }   or   { "status": "Withdrawn" }
proposalRoutes.put("/:id", async (req, res) => {
    const { status } = req.body;
    if (!["Pending", "Interviewing", "Accepted", "Declined", "Withdrawn"].includes(status)) {
        return res.status(400).json({ message: "Unknown status" });
    }
    try {
        const result = await pgclient.query(
            "UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *",
            [status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Proposal not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/proposals/1/accept
// Hiring: create the order, create its milestones, decline the other bids
// and close the job. Several writes, so they run inside a transaction - if
// one fails the whole thing rolls back instead of leaving a half-made order.
proposalRoutes.post("/:id/accept", async (req, res) => {
    try {
        await pgclient.query("BEGIN");

        const found = await pgclient.query(
            `SELECT p.*, j.client_id, j.title, j.description
             FROM proposals p JOIN jobs j ON j.id = p.job_id
             WHERE p.id = $1 AND p.status = 'Pending'`,
            [req.params.id]
        );

        if (found.rows.length === 0) {
            await pgclient.query("ROLLBACK");
            return res.status(404).json({ message: "Proposal not found or already decided" });
        }

        const proposal = found.rows[0];

        const order = await pgclient.query(
            `INSERT INTO orders (job_id, client_id, freelancer_id, project, brief, deadline)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [proposal.job_id, proposal.client_id, proposal.freelancer_id,
             proposal.title, proposal.description, addDays(proposal.days)]
        );
        const orderId = order.rows[0].id;

        // Use the milestone plan from the proposal, or one covering the whole bid.
        const plan = await pgclient.query(
            "SELECT title, amount FROM proposal_milestones WHERE proposal_id = $1 ORDER BY position",
            [proposal.id]
        );
        const milestones = plan.rows.length > 0
            ? plan.rows
            : [{ title: "Full delivery", amount: proposal.amount }];

        // Spread the due dates evenly across the days the freelancer asked for.
        for (let i = 0; i < milestones.length; i++) {
            const dueInDays = Math.round((proposal.days * (i + 1)) / milestones.length);
            const status = i === 0 ? "active" : "pending";

            await pgclient.query(
                `INSERT INTO milestones (order_id, position, title, amount, due_date, status)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, i + 1, milestones[i].title, milestones[i].amount,
                 addDays(dueInDays), status]
            );
        }

        await pgclient.query("UPDATE proposals SET status = 'Accepted' WHERE id = $1", [proposal.id]);
        await pgclient.query(
            "UPDATE proposals SET status = 'Declined' WHERE job_id = $1 AND id <> $2 AND status = 'Pending'",
            [proposal.job_id, proposal.id]
        );
        await pgclient.query("UPDATE jobs SET status = 'filled' WHERE id = $1", [proposal.job_id]);
        await pgclient.query(
            "INSERT INTO activity (order_id, actor, text) VALUES ($1, 'system', $2)",
            [orderId, "Escrow funded with $" + proposal.amount]
        );

        await pgclient.query("COMMIT");
        res.status(201).json(order.rows[0]);
    } catch (err) {
        await pgclient.query("ROLLBACK");
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/proposals/1
proposalRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM proposals WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Proposal not found" });
        }
        res.json({ message: "Proposal deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default proposalRoutes;