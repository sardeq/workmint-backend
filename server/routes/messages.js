import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { contract_id } = req.query;

  if (!contract_id) {
    return res.status(400).json({ message: "contract_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM messages WHERE contract_id = $1 ORDER BY sent_at",
    [contract_id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { contract_id, sender_role, body } = req.body;

  if (!contract_id || !sender_role || !body) {
    return res.status(400).json({ message: "contract_id, sender_role and body are required" });
  }

  const result = await db.query(
    `INSERT INTO messages (contract_id, sender_role, body)
     VALUES ($1, $2, $3) RETURNING *`,
    [contract_id, sender_role, body]
  );

  res.status(201).json(result.rows[0]);
});

export default router;
