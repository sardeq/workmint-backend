import express from "express";
import pgclient from "../db/db.js";
import { nextPosition } from "../helpers.js";

const disputeRoutes = express.Router();

// GET http://localhost:5000/api/disputes
// GET http://localhost:5000/api/disputes?status=Open
disputeRoutes.get("/", async (req, res) => {
    const { status } = req.query;
    try {
        let sql = `SELECT d.*, o.project, c.company AS client, f.name AS freelancer,
                          m.title AS milestone_title, m.deliverable_link
                   FROM disputes d
                   JOIN orders o     ON o.id = d.order_id
                   JOIN users c      ON c.id = o.client_id
                   JOIN users f      ON f.id = o.freelancer_id
                   JOIN milestones m ON m.id = d.milestone_id
                   WHERE 1 = 1`;
        const values = [];

        if (status) {
            values.push(status);
            sql = sql + ` AND d.status = $${values.length}`;
        }
        sql = sql + " ORDER BY d.opened_at";

        const result = await pgclient.query(sql, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET http://localhost:5000/api/disputes/1
disputeRoutes.get("/:id", async (req, res) => {
    try {
        const result = await pgclient.query("SELECT * FROM disputes WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Dispute not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/disputes
disputeRoutes.post("/", async (req, res) => {
    const { order_id, milestone_id, raised_by, reason, detail } = req.body;

    if (!order_id || !milestone_id || !raised_by || !reason || !detail) {
        return res.status(400).json({ message: "order_id, milestone_id, raised_by, reason and detail are required" });
    }

    try {
        const milestone = await pgclient.query(
            `SELECT * FROM milestones
             WHERE id = $1 AND order_id = $2
               AND status NOT IN ('approved', 'refunded', 'disputed')`,
            [milestone_id, order_id]
        );
        if (milestone.rows.length === 0) {
            return res.status(409).json({ message: "That milestone cannot be disputed" });
        }

        const result = await pgclient.query(
            `INSERT INTO disputes (order_id, milestone_id, raised_by, amount, reason, detail)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [order_id, milestone_id, raised_by, milestone.rows[0].amount, reason, detail]
        );

        await pgclient.query("UPDATE milestones SET status = 'disputed' WHERE id = $1", [milestone_id]);
        await pgclient.query(
            "INSERT INTO activity (order_id, actor, text) VALUES ($1, 'system', $2)",
            [order_id, `A dispute was opened by the ${raised_by}`]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});


disputeRoutes.put("/:id/resolve", async (req, res) => {
    const { resolution, note } = req.body;

    if (!["release", "refund", "split"].includes(resolution)) {
        return res.status(400).json({ message: "resolution must be release, refund or split" });
    }
    if (!note || note.length < 20) {
        return res.status(400).json({ message: "Write the reasoning, both sides see it" });
    }

    try {
        await pgclient.query("BEGIN");

        const result = await pgclient.query(
            `UPDATE disputes
             SET status = 'Resolved', resolution = $1, resolution_note = $2, resolved_at = NOW()
             WHERE id = $3 AND status <> 'Resolved'
             RETURNING *`,
            [resolution, note, req.params.id]
        );

        if (result.rows.length === 0) {
            await pgclient.query("ROLLBACK");
            return res.status(409).json({ message: "That case is already resolved" });
        }

        const dispute = result.rows[0];

        if (resolution === "release") {
            await pgclient.query(
                "UPDATE milestones SET status = 'approved', approved_on = NOW() WHERE id = $1",
                [dispute.milestone_id]
            );
        } else if (resolution === "refund") {
            await pgclient.query(
                "UPDATE milestones SET status = 'refunded', refunded_on = NOW() WHERE id = $1",
                [dispute.milestone_id]
            );
        } else {
            const half = Math.round(dispute.amount / 2);
            const updated = await pgclient.query(
                `UPDATE milestones
                 SET amount = amount - $1, status = 'approved', approved_on = NOW()
                 WHERE id = $2 RETURNING *`,
                [half, dispute.milestone_id]
            );
            const m = updated.rows[0];
            const position = await nextPosition(pgclient, m.order_id);

            await pgclient.query(
                `INSERT INTO milestones (order_id, position, title, amount, due_date, status, refunded_on)
                 VALUES ($1, $2, $3, $4, $5, 'refunded', NOW())`,
                [m.order_id, position, m.title + " (refunded half)", half, m.due_date]
            );
        }

        await pgclient.query(
            "INSERT INTO activity (order_id, actor, text) VALUES ($1, 'system', $2)",
            [dispute.order_id, "A mediator resolved the dispute: " + resolution]
        );

        await pgclient.query("COMMIT");
        res.json(dispute);
    } catch (err) {
        await pgclient.query("ROLLBACK");
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/disputes/1     (admin claims the case)
// { "status": "Under review" }
disputeRoutes.put("/:id", async (req, res) => {
    const { status } = req.body;
    if (!["Open", "Under review"].includes(status)) {
        return res.status(400).json({ message: "Use /resolve to close a case" });
    }
    try {
        const result = await pgclient.query(
            "UPDATE disputes SET status = $1 WHERE id = $2 RETURNING *",
            [status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Dispute not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/disputes/1
disputeRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM disputes WHERE id = $1 RETURNING *", [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Dispute not found" });
        }
        res.json({ message: "Dispute deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default disputeRoutes;