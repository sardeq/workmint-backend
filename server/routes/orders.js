import express from "express";
import pgclient from "../db/db.js";

const orderRoutes = express.Router();

// GET http://localhost:5000/api/orders?client_id=1
// GET http://localhost:5000/api/orders?freelancer_id=2
// order_totals is a view in schema.sql that does the escrow maths, so the
// released / escrow numbers are computed in one place instead of in JS.
orderRoutes.get("/", async (req, res) => {
    const { client_id, freelancer_id } = req.query;
    try {
        const result = await pgclient.query(
            `SELECT o.*, c.company AS client, c.name AS client_contact,
                    f.name AS freelancer_name, f.title AS freelancer_title, f.rating,
                    t.total, t.released, t.escrow, t.refunded
             FROM orders o
             JOIN users c ON c.id = o.client_id
             JOIN users f ON f.id = o.freelancer_id
             JOIN order_totals t ON t.order_id = o.id
             WHERE ($1::int IS NULL OR o.client_id = $1)
               AND ($2::int IS NULL OR o.freelancer_id = $2)
             ORDER BY o.deadline`,
            [client_id || null, freelancer_id || null]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET http://localhost:5000/api/orders/1
// Returns the order with everything hanging off it, which is what the
// project workspace screen needs in one request.
orderRoutes.get("/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const order = await pgclient.query(
            `SELECT o.*, c.company AS client, c.name AS client_contact,
                    f.name AS freelancer_name, f.title AS freelancer_title, f.rating,
                    t.total, t.released, t.escrow, t.refunded
             FROM orders o
             JOIN users c ON c.id = o.client_id
             JOIN users f ON f.id = o.freelancer_id
             JOIN order_totals t ON t.order_id = o.id
             WHERE o.id = $1`,
            [id]
        );

        if (order.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        const milestones = await pgclient.query(
            "SELECT * FROM milestones WHERE order_id = $1 ORDER BY position", [id]
        );
        const messages = await pgclient.query(
            "SELECT * FROM messages WHERE order_id = $1 ORDER BY sent_at", [id]
        );
        const activity = await pgclient.query(
            "SELECT * FROM activity WHERE order_id = $1 ORDER BY at DESC", [id]
        );
        const changes = await pgclient.query(
            "SELECT * FROM change_requests WHERE order_id = $1 ORDER BY created_at DESC", [id]
        );

        res.json({
            ...order.rows[0],
            milestones: milestones.rows,
            messages: messages.rows,
            activity: activity.rows,
            change_requests: changes.rows
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/orders
// Normally an order is created by accepting a proposal. This is here so you
// can make one directly while testing.
orderRoutes.post("/", async (req, res) => {
    const { client_id, freelancer_id, project, brief, deadline, revisions_included } = req.body;

    if (!client_id || !freelancer_id || !project || !deadline) {
        return res.status(400).json({ message: "client_id, freelancer_id, project and deadline are required" });
    }

    try {
        const result = await pgclient.query(
            `INSERT INTO orders (client_id, freelancer_id, project, brief, deadline, revisions_included)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [client_id, freelancer_id, project, brief, deadline, revisions_included || 2]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/orders/1
orderRoutes.put("/:id", async (req, res) => {
    const { project, brief, deadline, revisions_included, cancelled } = req.body;
    try {
        const result = await pgclient.query(
            `UPDATE orders SET project = $1, brief = $2, deadline = $3,
                               revisions_included = $4, cancelled = $5
             WHERE id = $6 RETURNING *`,
            [project, brief, deadline, revisions_included, cancelled || false, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/orders/1
orderRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM orders WHERE id = $1 RETURNING *", [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }
        res.json({ message: "Order deleted", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

/* ---------------------- scope change requests ------------------------- */

// POST http://localhost:5000/api/orders/1/change-requests
// { "reason": "...", "extra_cost": 450, "extra_days": 4 }
orderRoutes.post("/:id/change-requests", async (req, res) => {
    const { reason, extra_cost, extra_days } = req.body;
    try {
        const result = await pgclient.query(
            `INSERT INTO change_requests (order_id, reason, extra_cost, extra_days)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, reason, extra_cost || 0, extra_days || 0]
        );
        await pgclient.query(
            "INSERT INTO activity (order_id, actor, text) VALUES ($1, 'freelancer', 'Requested a scope change')",
            [req.params.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/orders/1/change-requests/1
// { "status": "Approved" }
// Approving adds the extra work as a new funded milestone.
orderRoutes.put("/:orderId/change-requests/:id", async (req, res) => {
    const { status } = req.body;
    if (!["Approved", "Declined"].includes(status)) {
        return res.status(400).json({ message: "status must be Approved or Declined" });
    }
    try {
        const result = await pgclient.query(
            `UPDATE change_requests SET status = $1, decided_at = NOW()
             WHERE id = $2 AND order_id = $3 AND status = 'Pending' RETURNING *`,
            [status, req.params.id, req.params.orderId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Request not found or already decided" });
        }

        const request = result.rows[0];
        if (status === "Approved" && request.extra_cost > 0) {
            await pgclient.query(
                `INSERT INTO milestones (order_id, position, title, amount, due_date, status)
                 VALUES ($1,
                         (SELECT COALESCE(MAX(position), 0) + 1 FROM milestones WHERE order_id = $1),
                         'Scope change: additional work', $2,
                         CURRENT_DATE + (GREATEST($3, 1) || ' days')::INTERVAL, 'pending')`,
                [req.params.orderId, request.extra_cost, request.extra_days]
            );
        }

        res.json(request);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default orderRoutes;