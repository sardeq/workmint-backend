import express from "express";
import db from "../db/db.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const { freelancer_id } = req.query;

  if (!freelancer_id) {
    return res.status(400).json({ message: "freelancer_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM withdrawals WHERE freelancer_id = $1 ORDER BY at DESC",
    [freelancer_id]
  );
  res.json(result.rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { freelancer_id, amount, method } = req.body;

  if (!freelancer_id || !amount || !method) {
    return res.status(400).json({ message: "freelancer_id, amount and method are required" });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ message: "The amount must be greater than zero" });
  }

  const result = await db.query(
    "INSERT INTO withdrawals (freelancer_id, amount, method) VALUES ($1, $2, $3) RETURNING *",
    [freelancer_id, amount, method]
  );

  res.status(201).json(result.rows[0]);
}));

export default router;
