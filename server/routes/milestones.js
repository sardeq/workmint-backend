import express from "express";
import db from "../db/db.js";
import { nextPosition, addActivity } from "../helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { order_id } = req.query;

  if (!order_id) {
    return res.status(400).json({ message: "order_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM milestones WHERE order_id = $1 ORDER BY position",
    [order_id]
  );
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const result = await db.query("SELECT * FROM milestones WHERE id = $1", [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Milestone not found" });
  }
  res.json(result.rows[0]);
});

router.post("/", async (req, res) => {
  const { order_id, title, amount, due_date } = req.body;

  if (!order_id || !title || !amount || !due_date) {
    return res.status(400).json({ message: "order_id, title, amount and due_date are required" });
  }

  const position = await nextPosition(order_id);

  const result = await db.query(
    `INSERT INTO milestones (order_id, position, title, amount, due_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [order_id, position, title, amount, due_date]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/:id/start", async (req, res) => {
  const result = await db.query(
    "UPDATE milestones SET status = 'active' WHERE id = $1 AND status = 'pending' RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ message: "That milestone is not waiting to be started" });
  }

  const milestone = result.rows[0];
  await addActivity(milestone.order_id, "freelancer", `Started "${milestone.title}"`);
  res.json(milestone);
});

router.put("/:id/deliver", async (req, res) => {
  const { link, note } = req.body;

  if (!link) {
    return res.status(400).json({ message: "A link to the work is required" });
  }

  const result = await db.query(
    `UPDATE milestones
     SET status = 'submitted', deliverable_link = $1, deliverable_note = $2, delivered_at = NOW()
     WHERE id = $3 AND status IN ('active', 'revision') RETURNING *`,
    [link, note || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ message: "That milestone is not ready to be delivered" });
  }

  const milestone = result.rows[0];
  await addActivity(milestone.order_id, "freelancer", `Delivered "${milestone.title}"`);
  res.json(milestone);
});

router.put("/:id/approve", async (req, res) => {
  const result = await db.query(
    `UPDATE milestones SET status = 'approved', approved_on = NOW()
     WHERE id = $1 AND status = 'submitted' RETURNING *`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ message: "That milestone is not awaiting review" });
  }

  const milestone = result.rows[0];
  await addActivity(
    milestone.order_id,
    "client",
    `Approved "${milestone.title}" - $${milestone.amount} released`
  );
  res.json(milestone);
});

router.put("/:id/revision", async (req, res) => {
  const { note } = req.body;

  if (!note || note.length < 15) {
    return res.status(400).json({ message: "Say what needs to change" });
  }

  const result = await db.query(
    `UPDATE milestones
     SET status = 'revision', revisions_used = revisions_used + 1, revision_note = $1
     WHERE id = $2 AND status = 'submitted' RETURNING *`,
    [note, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ message: "That milestone is not awaiting review" });
  }

  const milestone = result.rows[0];
  await addActivity(milestone.order_id, "client", `Requested a revision on "${milestone.title}"`);
  res.json(milestone);
});

router.put("/:id", async (req, res) => {
  const { title, amount, due_date } = req.body;

  const result = await db.query(
    "UPDATE milestones SET title = $1, amount = $2, due_date = $3 WHERE id = $4 RETURNING *",
    [title, amount, due_date, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Milestone not found" });
  }
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query(
    "DELETE FROM milestones WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Milestone not found" });
  }
  res.json({ message: "Milestone deleted" });
});

export default router;
