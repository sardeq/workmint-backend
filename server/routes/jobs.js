import express from "express";
import db from "../db/db.js";

const router = express.Router();

const JOB_SELECT = `SELECT j.*, u.company AS client, u.rating AS client_rating,
                      (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id) AS proposal_count
                    FROM jobs j
                    JOIN users u ON u.id = j.client_id`;

router.get("/", async (req, res) => {
  const { client_id, status } = req.query;

  if (client_id) {
    const result = await db.query(
      `${JOB_SELECT} WHERE j.status = $1 AND j.client_id = $2 ORDER BY j.created_at DESC`,
      [status || "open", client_id]
    );
    return res.json(result.rows);
  }

  const result = await db.query(
    `${JOB_SELECT} WHERE j.status = $1 ORDER BY j.created_at DESC`,
    [status || "open"]
  );
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const result = await db.query(`${JOB_SELECT} WHERE j.id = $1`, [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Job not found" });
  }
  res.json(result.rows[0]);
});

router.post("/", async (req, res) => {
  const { client_id, title, description, budget, days, level, skills } = req.body;

  if (!client_id || !title || !description || !budget || !days) {
    return res.status(400).json({ message: "client_id, title, description, budget and days are required" });
  }

  const result = await db.query(
    `INSERT INTO jobs (client_id, title, description, budget, days, level, skills)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [client_id, title, description, budget, days, level || "Intermediate", skills || []]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { title, description, budget, days, level, skills, status } = req.body;

  const result = await db.query(
    `UPDATE jobs SET title = $1, description = $2, budget = $3, days = $4,
                     level = $5, skills = $6, status = $7
     WHERE id = $8 RETURNING *`,
    [title, description, budget, days, level, skills, status || "open", req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Job not found" });
  }
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query(
    "UPDATE jobs SET status = 'closed' WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Job not found" });
  }

  await db.query(
    "UPDATE proposals SET status = 'Declined' WHERE job_id = $1 AND status = 'Pending'",
    [req.params.id]
  );

  res.json({ message: "Job closed", job: result.rows[0] });
});

export default router;
