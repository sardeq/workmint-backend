import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { client_id } = req.query;

  if (!client_id) {
    return res.status(400).json({ message: "client_id is required" });
  }

  const result = await db.query(
    `SELECT p.*, m.label AS method_label
     FROM payments p
     LEFT JOIN payment_methods m ON m.id = p.method_id
     WHERE p.client_id = $1
     ORDER BY p.paid_at DESC`,
    [client_id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { client_id, method_id, note, amount_usd, currency, rate, amount_converted } = req.body;

  if (!client_id || !note || !amount_usd || !currency || !rate) {
    return res.status(400).json({ message: "client_id, note, amount_usd, currency and rate are required" });
  }
  if (Number(amount_usd) <= 0) {
    return res.status(400).json({ message: "The amount must be greater than zero" });
  }

  const result = await db.query(
    `INSERT INTO payments (client_id, method_id, note, amount_usd, currency, rate, amount_converted)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [client_id, method_id || null, note, amount_usd, currency, rate, amount_converted]
  );

  res.status(201).json(result.rows[0]);
});

export default router;
