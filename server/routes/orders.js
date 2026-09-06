import express from "express";
import db from "../db/db.js";
import { addDays, nextPosition, addActivity } from "../helpers.js";

const router = express.Router();

const ORDER_SELECT = `SELECT o.*, c.company AS client, c.name AS client_contact,
                        f.name AS freelancer_name, f.title AS freelancer_title, f.rating
                      FROM orders o
                      JOIN users c ON c.id = o.client_id
                      JOIN users f ON f.id = o.freelancer_id`;

router.get("/", async (req, res) => {
  const { client_id, freelancer_id } = req.query;

  if (client_id) {
    const result = await db.query(
      `${ORDER_SELECT} WHERE o.client_id = $1 ORDER BY o.deadline`,
      [client_id]
    );
    return res.json(result.rows);
  }

  if (freelancer_id) {
    const result = await db.query(
      `${ORDER_SELECT} WHERE o.freelancer_id = $1 ORDER BY o.deadline`,
      [freelancer_id]
    );
    return res.json(result.rows);
  }

  const result = await db.query(`${ORDER_SELECT} ORDER BY o.deadline`);
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const order = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);

  if (order.rows.length === 0) {
    return res.status(404).json({ message: "Order not found" });
  }

  const milestones = await db.query(
    "SELECT * FROM milestones WHERE order_id = $1 ORDER BY position",
    [id]
  );
  const messages = await db.query(
    "SELECT * FROM messages WHERE order_id = $1 ORDER BY sent_at",
    [id]
  );
  const activity = await db.query(
    "SELECT * FROM activity WHERE order_id = $1 ORDER BY at DESC",
    [id]
  );
  const changes = await db.query(
    "SELECT * FROM change_requests WHERE order_id = $1 ORDER BY created_at DESC",
    [id]
  );

  res.json({
    ...order.rows[0],
    milestones: milestones.rows,
    messages: messages.rows,
    activity: activity.rows,
    change_requests: changes.rows,
  });
});

router.post("/", async (req, res) => {
  const { client_id, freelancer_id, project, brief, deadline, revisions_included } = req.body;

  if (!client_id || !freelancer_id || !project || !deadline) {
    return res.status(400).json({ message: "client_id, freelancer_id, project and deadline are required" });
  }

  const result = await db.query(
    `INSERT INTO orders (client_id, freelancer_id, project, brief, deadline, revisions_included)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [client_id, freelancer_id, project, brief, deadline, revisions_included || 2]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { project, brief, deadline, revisions_included, cancelled } = req.body;

  const result = await db.query(
    `UPDATE orders SET project = $1, brief = $2, deadline = $3,
                       revisions_included = $4, cancelled = $5
     WHERE id = $6 RETURNING *`,
    [project, brief, deadline, revisions_included, cancelled || false, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Order not found" });
  }
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query("DELETE FROM orders WHERE id = $1 RETURNING *", [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Order not found" });
  }
  res.json({ message: "Order deleted", order: result.rows[0] });
});

router.post("/:id/change-requests", async (req, res) => {
  const { reason, extra_cost, extra_days } = req.body;

  const result = await db.query(
    `INSERT INTO change_requests (order_id, reason, extra_cost, extra_days)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.id, reason, extra_cost || 0, extra_days || 0]
  );

  await addActivity(req.params.id, "freelancer", "Requested a scope change");

  res.status(201).json(result.rows[0]);
});

router.put("/:orderId/change-requests/:id", async (req, res) => {
  const { status } = req.body;

  if (!["Approved", "Declined"].includes(status)) {
    return res.status(400).json({ message: "status must be Approved or Declined" });
  }

  const result = await db.query(
    `UPDATE change_requests SET status = $1, decided_at = NOW()
     WHERE id = $2 AND order_id = $3 AND status = 'Pending' RETURNING *`,
    [status, req.params.id, req.params.orderId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Request not found or already decided" });
  }

  const request = result.rows[0];

  if (status === "Approved" && Number(request.extra_cost) > 0) {
    const position = await nextPosition(req.params.orderId);
    const extraDays = request.extra_days > 0 ? request.extra_days : 1;

    await db.query(
      `INSERT INTO milestones (order_id, position, title, amount, due_date, status)
       VALUES ($1, $2, 'Scope change: additional work', $3, $4, 'pending')`,
      [req.params.orderId, position, request.extra_cost, addDays(extraDays)]
    );
  }

  res.json(request);
});

export default router;
