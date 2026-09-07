import express from "express";
import db from "../db/db.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();

const PROPOSAL_SELECT = `SELECT p.*, j.title AS job_title, j.budget AS job_budget,
                           j.client_id, c.company AS client,
                           f.name AS freelancer_name, f.title AS freelancer_title,
                           f.rating, f.skills
                         FROM proposals p
                         JOIN jobs j ON j.id = p.job_id
                         JOIN users c ON c.id = j.client_id
                         JOIN users f ON f.id = p.freelancer_id`;

router.get("/", asyncHandler(async (req, res) => {
  const { freelancer_id, client_id } = req.query;

  if (freelancer_id) {
    const result = await db.query(
      `${PROPOSAL_SELECT} WHERE p.freelancer_id = $1 ORDER BY p.sent_at DESC`,
      [freelancer_id]
    );
    return res.json(result.rows);
  }

  if (client_id) {
    const result = await db.query(
      `${PROPOSAL_SELECT} WHERE j.client_id = $1 ORDER BY p.sent_at DESC`,
      [client_id]
    );
    return res.json(result.rows);
  }

  const result = await db.query(`${PROPOSAL_SELECT} ORDER BY p.sent_at DESC`);
  res.json(result.rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { job_id, freelancer_id, amount, days, cover } = req.body;

  if (!job_id || !freelancer_id || !amount || !days || !cover) {
    return res.status(400).json({ message: "job_id, freelancer_id, amount, days and cover are required" });
  }

  const already = await db.query(
    "SELECT id FROM proposals WHERE job_id = $1 AND freelancer_id = $2",
    [job_id, freelancer_id]
  );
  if (already.rows.length > 0) {
    return res.status(409).json({ message: "You already applied to this job" });
  }

  const result = await db.query(
    `INSERT INTO proposals (job_id, freelancer_id, amount, days, cover)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [job_id, freelancer_id, amount, days, cover]
  );

  res.status(201).json(result.rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["Declined", "Withdrawn"].includes(status)) {
    return res.status(400).json({ message: "status must be Declined or Withdrawn" });
  }

  const result = await db.query(
    "UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Proposal not found" });
  }
  res.json(result.rows[0]);
}));

router.post("/:id/accept", asyncHandler(async (req, res) => {
  const found = await db.query(
    `SELECT p.*, j.client_id, j.title, j.description
     FROM proposals p JOIN jobs j ON j.id = p.job_id
     WHERE p.id = $1 AND p.status = 'Pending'`,
    [req.params.id]
  );

  if (found.rows.length === 0) {
    return res.status(404).json({ message: "Proposal not found or already decided" });
  }

  const proposal = found.rows[0];

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + Number(proposal.days));

  const contract = await db.query(
    `INSERT INTO contracts (job_id, client_id, freelancer_id, title, brief, amount, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      proposal.job_id,
      proposal.client_id,
      proposal.freelancer_id,
      proposal.title,
      proposal.description,
      proposal.amount,
      deadline.toISOString().slice(0, 10),
    ]
  );

  await db.query("UPDATE proposals SET status = 'Accepted' WHERE id = $1", [proposal.id]);
  await db.query(
    "UPDATE proposals SET status = 'Declined' WHERE job_id = $1 AND id <> $2 AND status = 'Pending'",
    [proposal.job_id, proposal.id]
  );
  await db.query("UPDATE jobs SET status = 'filled' WHERE id = $1", [proposal.job_id]);

  res.status(201).json(contract.rows[0]);
}));

export default router;
