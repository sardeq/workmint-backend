import express from "express";
import pgclient from "../db/db.js";

const messageRoutes = express.Router();

// GET http://localhost:5000/api/messages?order_id=1
messageRoutes.get("/", async (req, res) => {
    const { order_id } = req.query;
    if (!order_id) {
        return res.status(400).json({ message: "order_id is required" });
    }
    try {
        const result = await pgclient.query(
            "SELECT * FROM messages WHERE order_id = $1 ORDER BY sent_at",
            [order_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/messages
// { "order_id": 1, "sender_role": "client", "body": "hello" }
messageRoutes.post("/", async (req, res) => {
    const { order_id, sender_role, body } = req.body;

    if (!order_id || !sender_role || !body) {
        return res.status(400).json({ message: "order_id, sender_role and body are required" });
    }

    try {
        const result = await pgclient.query(
            "INSERT INTO messages (order_id, sender_role, body) VALUES ($1, $2, $3) RETURNING *",
            [order_id, sender_role, body]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/messages/read
// Opening a thread marks the OTHER side's messages as read.
// { "order_id": 1, "reader_role": "client" }
messageRoutes.put("/read", async (req, res) => {
    const { order_id, reader_role } = req.body;
    try {
        const result = await pgclient.query(
            `UPDATE messages SET read = TRUE
             WHERE order_id = $1 AND sender_role <> $2 AND read = FALSE
             RETURNING id`,
            [order_id, reader_role]
        );
        res.json({ message: "Marked as read", count: result.rows.length });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/messages/4
messageRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM messages WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Message not found" });
        }
        res.json({ message: "Message deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default messageRoutes;