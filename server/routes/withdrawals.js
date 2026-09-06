import express from "express";
import db from "../db/db.js";

const router = express.Router();

const FEE_RATE = 0.1;

async function availableFor(freelancerId) {
  const earned = await db.query(
    `SELECT COALESCE(SUM(m.amount), 0) AS released
     FROM milestones m
     JOIN orders o ON o.id = m.order_id
     WHERE o.freelancer_id = $1 AND m.status = 'approved'`,
    [freelancerId]
  );

  const taken = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid_out
     FROM withdrawals WHERE freelancer_id = $1 AND status <> 'Failed'`,
    [freelancerId]
  );

  const net = Math.round(Number(earned.rows[0].released) * (1 - FEE_RATE));
  return net - Number(taken.rows[0].paid_out);
}

router.get("/", async (req, res) => {
  const { freelancer_id } = req.query;

  if (!freelancer_id) {
    return res.status(400).json({ message: "freelancer_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM withdrawals WHERE freelancer_id = $1 ORDER BY at DESC",
    [freelancer_id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { freelancer_id, amount, method } = req.body;

  if (!freelancer_id || !amount || !method) {
    return res.status(400).json({ message: "freelancer_id, amount and method are required" });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ message: "Amount has to be more than zero" });
  }

  const available = await availableFor(freelancer_id);
  if (Number(amount) > available) {
    return res.status(400).json({ message: `Only ${available} is available to withdraw right now` });
  }

  const result = await db.query(
    "INSERT INTO withdrawals (freelancer_id, amount, method) VALUES ($1, $2, $3) RETURNING *",
    [freelancer_id, amount, method]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { status } = req.body;

  if (!["Processing", "Paid", "Failed"].includes(status)) {
    return res.status(400).json({ message: "status has to be Processing, Paid or Failed" });
  }

  const result = await db.query(
    "UPDATE withdrawals SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Withdrawal not found" });
  }
  res.json(result.rows[0]);
});

export default router;
