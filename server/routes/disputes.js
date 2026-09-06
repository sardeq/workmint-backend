import express from "express";
import db from "../db/db.js";
import { nextPosition, addActivity } from "../helpers.js";

const router = express.Router();

const DISPUTE_SELECT = `SELECT d.*, o.project, c.company AS client, f.name AS freelancer,
                          m.title AS milestone_title, m.deliverable_link
                        FROM disputes d
                        JOIN orders o ON o.id = d.order_id
                        JOIN users c ON c.id = o.client_id
                        JOIN users f ON f.id = o.freelancer_id
                        JOIN milestones m ON m.id = d.milestone_id`;

router.get("/", async (req, res) => {
  const { status } = req.query;

  if (status) {
    const result = await db.query(
      `${DISPUTE_SELECT} WHERE d.status = $1 ORDER BY d.opened_at`,
      [status]
    );
    return res.json(result.rows);
  }

  const result = await db.query(`${DISPUTE_SELECT} ORDER BY d.opened_at`);
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const result = await db.query("SELECT * FROM disputes WHERE id = $1", [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Dispute not found" });
  }
  res.json(result.rows[0]);
});

router.post("/", async (req, res) => {
  const { order_id, milestone_id, raised_by, reason, detail } = req.body;

  if (!order_id || !milestone_id || !raised_by || !reason || !detail) {
    return res.status(400).json({ message: "order_id, milestone_id, raised_by, reason and detail are required" });
  }

  const milestone = await db.query(
    `SELECT * FROM milestones
     WHERE id = $1 AND order_id = $2 AND status NOT IN ('approved', 'refunded', 'disputed')`,
    [milestone_id, order_id]
  );

  if (milestone.rows.length === 0) {
    return res.status(409).json({ message: "That milestone cannot be disputed" });
  }

  const result = await db.query(
    `INSERT INTO disputes (order_id, milestone_id, raised_by, amount, reason, detail)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [order_id, milestone_id, raised_by, milestone.rows[0].amount, reason, detail]
  );

  await db.query("UPDATE milestones SET status = 'disputed' WHERE id = $1", [milestone_id]);
  await addActivity(order_id, "system", `A dispute was opened by the ${raised_by}`);

  res.status(201).json(result.rows[0]);
});

router.put("/:id/resolve", async (req, res) => {
  const { resolution, note } = req.body;

  if (!["release", "refund", "split"].includes(resolution)) {
    return res.status(400).json({ message: "resolution must be release, refund or split" });
  }
  if (!note || note.length < 20) {
    return res.status(400).json({ message: "Write the reasoning, both sides see it" });
  }

  const result = await db.query(
    `UPDATE disputes
     SET status = 'Resolved', resolution = $1, resolution_note = $2, resolved_at = NOW()
     WHERE id = $3 AND status <> 'Resolved' RETURNING *`,
    [resolution, note, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ message: "That case is already resolved" });
  }

  const dispute = result.rows[0];

  if (resolution === "release") {
    await db.query(
      "UPDATE milestones SET status = 'approved', approved_on = NOW() WHERE id = $1",
      [dispute.milestone_id]
    );
  } else if (resolution === "refund") {
    await db.query(
      "UPDATE milestones SET status = 'refunded', refunded_on = NOW() WHERE id = $1",
      [dispute.milestone_id]
    );
  } else {
    const half = Math.round(Number(dispute.amount) / 2);

    const updated = await db.query(
      `UPDATE milestones SET amount = amount - $1, status = 'approved', approved_on = NOW()
       WHERE id = $2 RETURNING *`,
      [half, dispute.milestone_id]
    );

    const milestone = updated.rows[0];
    const position = await nextPosition(milestone.order_id);

    await db.query(
      `INSERT INTO milestones (order_id, position, title, amount, due_date, status, refunded_on)
       VALUES ($1, $2, $3, $4, $5, 'refunded', NOW())`,
      [milestone.order_id, position, `${milestone.title} (refunded half)`, half, milestone.due_date]
    );
  }

  await addActivity(dispute.order_id, "system", `A mediator resolved the dispute: ${resolution}`);

  res.json(dispute);
});

router.put("/:id", async (req, res) => {
  const { status } = req.body;

  if (!["Open", "Under review"].includes(status)) {
    return res.status(400).json({ message: "Use /resolve to close a case" });
  }

  const result = await db.query(
    "UPDATE disputes SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Dispute not found" });
  }
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query("DELETE FROM disputes WHERE id = $1 RETURNING *", [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Dispute not found" });
  }
  res.json({ message: "Dispute deleted" });
});

export default router;
