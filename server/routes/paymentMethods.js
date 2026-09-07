import express from "express";
import db from "../db/db.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const { client_id } = req.query;

  if (!client_id) {
    return res.status(400).json({ message: "client_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM payment_methods WHERE client_id = $1 ORDER BY id",
    [client_id]
  );
  res.json(result.rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { client_id, label, kind } = req.body;

  if (!client_id || !label || !kind) {
    return res.status(400).json({ message: "client_id, label and kind are required" });
  }

  const result = await db.query(
    "INSERT INTO payment_methods (client_id, label, kind) VALUES ($1, $2, $3) RETURNING *",
    [client_id, label, kind]
  );

  res.status(201).json(result.rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await db.query(
    "DELETE FROM payment_methods WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Payment method not found" });
  }
  res.json({ message: "Payment method removed", method: result.rows[0] });
}));

export default router;
