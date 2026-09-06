import express from "express";
import db from "../db/db.js";
import { addDays, addActivity } from "../helpers.js";

const router = express.Router();

const PROPOSAL_SELECT = `SELECT p.*, j.title AS job_title, j.budget AS job_budget,
                           c.company AS client, f.name AS freelancer_name,
                           f.title AS freelancer_title, f.rating, f.skills
                         FROM proposals p
                         JOIN jobs j ON j.id = p.job_id
                         JOIN users c ON c.id = j.client_id
                         JOIN users f ON f.id = p.freelancer_id`;

router.get("/", async (req, res) => {
  const { freelancer_id, client_id, job_id } = req.query;

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

  if (job_id) {
    const result = await db.query(
      `${PROPOSAL_SELECT} WHERE p.job_id = $1 ORDER BY p.sent_at DESC`,
      [job_id]
    );
    return res.json(result.rows);
  }

  const result = await db.query(`${PROPOSAL_SELECT} ORDER BY p.sent_at DESC`);
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const result = await db.query("SELECT * FROM proposals WHERE id = $1", [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Proposal not found" });
  }
  res.json(result.rows[0]);
});

router.post("/", async (req, res) => {
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
});

router.put("/:id", async (req, res) => {
  const { status } = req.body;

  if (!["Pending", "Interviewing", "Accepted", "Declined", "Withdrawn"].includes(status)) {
    return res.status(400).json({ message: "Unknown status" });
  }

  const result = await db.query(
    "UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Proposal not found" });
  }
  res.json(result.rows[0]);
});

router.post("/:id/accept", async (req, res) => {
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

  const order = await db.query(
    `INSERT INTO orders (job_id, client_id, freelancer_id, project, brief, deadline)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      proposal.job_id,
      proposal.client_id,
      proposal.freelancer_id,
      proposal.title,
      proposal.description,
      addDays(proposal.days),
    ]
  );

  const orderId = order.rows[0].id;

  await db.query(
    `INSERT INTO milestones (order_id, position, title, amount, due_date, status)
     VALUES ($1, 1, 'Full delivery', $2, $3, 'active')`,
    [orderId, proposal.amount, addDays(proposal.days)]
  );

  await db.query("UPDATE proposals SET status = 'Accepted' WHERE id = $1", [proposal.id]);
  await db.query(
    "UPDATE proposals SET status = 'Declined' WHERE job_id = $1 AND id <> $2 AND status = 'Pending'",
    [proposal.job_id, proposal.id]
  );
  await db.query("UPDATE jobs SET status = 'filled' WHERE id = $1", [proposal.job_id]);
  await addActivity(orderId, "system", `Escrow funded with $${proposal.amount}`);

  res.status(201).json(order.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query(
    "DELETE FROM proposals WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Proposal not found" });
  }
  res.json({ message: "Proposal deleted" });
});

export default router;
