import express from "express";
import pgclient from "../db/db.js";

const jobRoutes = express.Router();

// GET http://localhost:5000/api/jobs
// GET http://localhost:5000/api/jobs?client_id=1
jobRoutes.get("/", async (req, res) => {
    const { client_id, status } = req.query;
    try {
        const result = await pgclient.query(
            `SELECT j.*, u.company AS client, u.rating AS client_rating,
                    (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id) AS proposal_count
             FROM jobs j
             JOIN users u ON u.id = j.client_id
             WHERE ($1::int IS NULL OR j.client_id = $1)
               AND ($2::text IS NULL OR j.status = $2)
             ORDER BY j.created_at DESC`,
            [client_id || null, status || "open"]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET http://localhost:5000/api/jobs/1
jobRoutes.get("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            `SELECT j.*, u.company AS client, u.rating AS client_rating
             FROM jobs j JOIN users u ON u.id = j.client_id
             WHERE j.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/jobs
// { "client_id": 1, "title": "...", "description": "...", "budget": 2500,
//   "days": 21, "level": "Intermediate", "skills": ["React.js"] }
jobRoutes.post("/", async (req, res) => {
    const { client_id, title, description, budget, days, level, skills } = req.body;

    if (!client_id || !title || !description || !budget || !days) {
        return res.status(400).json({ message: "client_id, title, description, budget and days are required" });
    }

    try {
        const result = await pgclient.query(
            `INSERT INTO jobs (client_id, title, description, budget, days, level, skills)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [client_id, title, description, budget, days, level || "Intermediate", skills || []]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/jobs/1
jobRoutes.put("/:id", async (req, res) => {
    const { title, description, budget, days, level, skills, status } = req.body;
    try {
        const result = await pgclient.query(
            `UPDATE jobs
             SET title = $1, description = $2, budget = $3, days = $4,
                 level = $5, skills = $6, status = $7
             WHERE id = $8 RETURNING *`,
            [title, description, budget, days, level, skills, status || "open", req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/jobs/1
// Closing a listing also declines the proposals still waiting on it.
jobRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "UPDATE jobs SET status = 'closed' WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        await pgclient.query(
            "UPDATE proposals SET status = 'Declined' WHERE job_id = $1 AND status = 'Pending'",
            [req.params.id]
        );
        res.json({ message: "Job closed", job: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default jobRoutes;