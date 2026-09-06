import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { order_id } = req.query;

  if (!order_id) {
    return res.status(400).json({ message: "order_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM messages WHERE order_id = $1 ORDER BY sent_at",
    [order_id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { order_id, sender_role, body } = req.body;

  if (!order_id || !sender_role || !body) {
    return res.status(400).json({ message: "order_id, sender_role and body are required" });
  }

  const result = await db.query(
    "INSERT INTO messages (order_id, sender_role, body) VALUES ($1, $2, $3) RETURNING *",
    [order_id, sender_role, body]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/read", async (req, res) => {
  const { order_id, reader_role } = req.body;

  const result = await db.query(
    `UPDATE messages SET read = TRUE
     WHERE order_id = $1 AND sender_role <> $2 AND read = FALSE RETURNING id`,
    [order_id, reader_role]
  );

  res.json({ message: "Marked as read", count: result.rows.length });
});

router.delete("/:id", async (req, res) => {
  const result = await db.query("DELETE FROM messages WHERE id = $1 RETURNING *", [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Message not found" });
  }
  res.json({ message: "Message deleted" });
});

export default router;
