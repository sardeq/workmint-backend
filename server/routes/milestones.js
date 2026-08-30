import express from "express";
import pgclient from "../db/db.js";

const milestoneRoutes = express.Router();

/* A milestone moves through these states, and each move is one PUT:

     pending -> active -> submitted -> approved      (money released)
                              |
                              +-----> revision -> submitted -> ...

   Every UPDATE below checks the current status in its WHERE clause, so the
   database refuses an out-of-order move even if the request asks for one.  */

// GET http://localhost:5000/api/milestones?order_id=1
milestoneRoutes.get("/", async (req, res) => {
    const { order_id } = req.query;
    if (!order_id) {
        return res.status(400).json({ message: "order_id is required" });
    }
    try {
        const result = await pgclient.query(
            "SELECT * FROM milestones WHERE order_id = $1 ORDER BY position",
            [order_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET http://localhost:5000/api/milestones/3
milestoneRoutes.get("/:id", async (req, res) => {
    try {
        const result = await pgclient.query("SELECT * FROM milestones WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/milestones
// { "order_id": 1, "title": "Backend", "amount": 1200, "due_date": "2026-09-30" }
milestoneRoutes.post("/", async (req, res) => {
    const { order_id, title, amount, due_date } = req.body;

    if (!order_id || !title || !amount || !due_date) {
        return res.status(400).json({ message: "order_id, title, amount and due_date are required" });
    }

    try {
        const result = await pgclient.query(
            `INSERT INTO milestones (order_id, position, title, amount, due_date)
             VALUES ($1,
                     (SELECT COALESCE(MAX(position), 0) + 1 FROM milestones WHERE order_id = $1),
                     $2, $3, $4)
             RETURNING *`,
            [order_id, title, amount, due_date]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/milestones/3/start        (freelancer)
milestoneRoutes.put("/:id/start", async (req, res) => {
    try {
        const result = await pgclient.query(
            `UPDATE milestones SET status = 'active'
             WHERE id = $1 AND status = 'pending' RETURNING *`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ message: "That milestone is not waiting to be started" });
        }
        await logActivity(result.rows[0].order_id, "freelancer", `Started "${result.rows[0].title}"`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/milestones/3/deliver      (freelancer)
// { "link": "https://github.com/...", "note": "look at the PR first" }
milestoneRoutes.put("/:id/deliver", async (req, res) => {
    const { link, note } = req.body;
    if (!link) {
        return res.status(400).json({ message: "A link to the work is required" });
    }
    try {
        const result = await pgclient.query(
            `UPDATE milestones
             SET status = 'submitted', deliverable_link = $1, deliverable_note = $2, delivered_at = NOW()
             WHERE id = $3 AND status IN ('active', 'revision')
             RETURNING *`,
            [link, note || null, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ message: "That milestone is not ready to be delivered" });
        }
        await logActivity(result.rows[0].order_id, "freelancer", `Delivered "${result.rows[0].title}"`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/milestones/3/approve      (client)
// This is the only normal path that releases money.
milestoneRoutes.put("/:id/approve", async (req, res) => {
    try {
        const result = await pgclient.query(
            `UPDATE milestones SET status = 'approved', approved_on = NOW()
             WHERE id = $1 AND status = 'submitted' RETURNING *`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ message: "That milestone is not awaiting review" });
        }
        const m = result.rows[0];
        await logActivity(m.order_id, "client", `Approved "${m.title}" - $${m.amount} released`);
        res.json(m);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/milestones/3/revision     (client)
// { "note": "the retry logic needs exponential backoff" }
milestoneRoutes.put("/:id/revision", async (req, res) => {
    const { note } = req.body;
    if (!note || note.length < 15) {
        return res.status(400).json({ message: "Say what needs to change" });
    }
    try {
        const result = await pgclient.query(
            `UPDATE milestones
             SET status = 'revision', revisions_used = revisions_used + 1, revision_note = $1
             WHERE id = $2 AND status = 'submitted'
             RETURNING *`,
            [note, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ message: "That milestone is not awaiting review" });
        }
        await logActivity(result.rows[0].order_id, "client", `Requested a revision on "${result.rows[0].title}"`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/milestones/3      (edit title / amount / date)
milestoneRoutes.put("/:id", async (req, res) => {
    const { title, amount, due_date } = req.body;
    try {
        const result = await pgclient.query(
            `UPDATE milestones SET title = $1, amount = $2, due_date = $3
             WHERE id = $4 RETURNING *`,
            [title, amount, due_date, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/milestones/3
milestoneRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM milestones WHERE id = $1 RETURNING *", [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        res.json({ message: "Milestone deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// Small helper so every route above does not repeat the same INSERT.
async function logActivity(orderId, actor, text) {
    await pgclient.query(
        "INSERT INTO activity (order_id, actor, text) VALUES ($1, $2, $3)",
        [orderId, actor, text]
    );
}

export default milestoneRoutes;