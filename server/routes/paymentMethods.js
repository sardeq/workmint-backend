import express from "express";
import pgclient from "../db/db.js";

const paymentMethodRoutes = express.Router();

// GET http://localhost:5000/api/payment-methods?client_id=1
paymentMethodRoutes.get("/", async (req, res) => {
    const { client_id } = req.query;

    if (!client_id) {
        return res.status(400).json({ message: "client_id is required" });
    }

    try {
        const result = await pgclient.query(
            `SELECT * FROM payment_methods
             WHERE client_id = $1
             ORDER BY is_primary DESC, id`,
            [client_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/payment-methods
paymentMethodRoutes.post("/", async (req, res) => {
    const { client_id, label, kind } = req.body;

    if (!client_id || !label || !kind) {
        return res.status(400).json({ message: "client_id, label and kind are required" });
    }
    if (!["Card", "Bank", "PayPal"].includes(kind)) {
        return res.status(400).json({ message: "kind has to be Card, Bank or PayPal" });
    }

    try {
        const existing = await pgclient.query(
            "SELECT COUNT(*) AS count FROM payment_methods WHERE client_id = $1",
            [client_id]
        );
        const isFirst = Number(existing.rows[0].count) === 0;

        const result = await pgclient.query(
            `INSERT INTO payment_methods (client_id, label, kind, is_primary)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [client_id, label, kind, isFirst]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/payment-methods/2/primary
paymentMethodRoutes.put("/:id/primary", async (req, res) => {
    try {
        const found = await pgclient.query(
            "SELECT client_id FROM payment_methods WHERE id = $1",
            [req.params.id]
        );
        if (found.rows.length === 0) {
            return res.status(404).json({ message: "Payment method not found" });
        }

        await pgclient.query(
            "UPDATE payment_methods SET is_primary = FALSE WHERE client_id = $1",
            [found.rows[0].client_id]
        );
        const result = await pgclient.query(
            "UPDATE payment_methods SET is_primary = TRUE WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/payment-methods/2
paymentMethodRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM payment_methods WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Payment method not found" });
        }
        res.json({ message: "Payment method removed", method: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default paymentMethodRoutes;
