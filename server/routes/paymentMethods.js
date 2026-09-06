import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { client_id } = req.query;

  if (!client_id) {
    return res.status(400).json({ message: "client_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM payment_methods WHERE client_id = $1 ORDER BY is_primary DESC, id",
    [client_id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { client_id, label, kind } = req.body;

  if (!client_id || !label || !kind) {
    return res.status(400).json({ message: "client_id, label and kind are required" });
  }
  if (!["Card", "Bank", "PayPal"].includes(kind)) {
    return res.status(400).json({ message: "kind has to be Card, Bank or PayPal" });
  }

  const existing = await db.query(
    "SELECT * FROM payment_methods WHERE client_id = $1",
    [client_id]
  );
  const isFirst = existing.rows.length === 0;

  const result = await db.query(
    `INSERT INTO payment_methods (client_id, label, kind, is_primary)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [client_id, label, kind, isFirst]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/:id/primary", async (req, res) => {
  const found = await db.query(
    "SELECT * FROM payment_methods WHERE id = $1",
    [req.params.id]
  );

  if (found.rows.length === 0) {
    return res.status(404).json({ message: "Payment method not found" });
  }

  await db.query(
    "UPDATE payment_methods SET is_primary = FALSE WHERE client_id = $1",
    [found.rows[0].client_id]
  );

  const result = await db.query(
    "UPDATE payment_methods SET is_primary = TRUE WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query(
    "DELETE FROM payment_methods WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Payment method not found" });
  }
  res.json({ message: "Payment method removed", method: result.rows[0] });
});

export default router;
