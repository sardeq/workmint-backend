import express from "express";
import db from "../db/db.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();

const CONTRACT_SELECT = `SELECT c.*, cl.company AS client, cl.name AS client_contact,
                           f.name AS freelancer_name, f.title AS freelancer_title, f.rating
                         FROM contracts c
                         JOIN users cl ON cl.id = c.client_id
                         JOIN users f  ON f.id  = c.freelancer_id`;

router.get("/", asyncHandler(async (req, res) => {
  const { client_id, freelancer_id } = req.query;

  if (client_id) {
    const result = await db.query(
      `${CONTRACT_SELECT} WHERE c.client_id = $1 ORDER BY c.deadline`,
      [client_id]
    );
    return res.json(result.rows);
  }

  if (freelancer_id) {
    const result = await db.query(
      `${CONTRACT_SELECT} WHERE c.freelancer_id = $1 ORDER BY c.deadline`,
      [freelancer_id]
    );
    return res.json(result.rows);
  }

  const result = await db.query(`${CONTRACT_SELECT} ORDER BY c.deadline`);
  res.json(result.rows);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const contract = await db.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [req.params.id]);

  if (contract.rows.length === 0) {
    return res.status(404).json({ message: "Contract not found" });
  }

  const messages = await db.query(
    "SELECT * FROM messages WHERE contract_id = $1 ORDER BY sent_at",
    [req.params.id]
  );

  res.json({ ...contract.rows[0], messages: messages.rows });
}));

router.put("/:id/deliver", asyncHandler(async (req, res) => {
  const { link, note } = req.body;

  if (!link) {
    return res.status(400).json({ message: "A delivery link is required" });
  }

  const result = await db.query(
    `UPDATE contracts
     SET status = 'delivered', delivery_link = $1, delivery_note = $2, delivered_at = NOW()
     WHERE id = $3 AND status IN ('in_progress', 'revision')
     RETURNING *`,
    [link, note || null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ message: "This contract is not waiting on a delivery" });
  }
  res.json(result.rows[0]);
}));

router.put("/:id/approve", asyncHandler(async (req, res) => {
  const result = await db.query(
    `UPDATE contracts
     SET status = 'approved', approved_at = NOW()
     WHERE id = $1 AND status = 'delivered'
     RETURNING *`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ message: "Nothing has been delivered to approve" });
  }
  res.json(result.rows[0]);
}));

router.put("/:id/revision", asyncHandler(async (req, res) => {
  const { note } = req.body;

  if (!note) {
    return res.status(400).json({ message: "Say what needs changing" });
  }

  const result = await db.query(
    `UPDATE contracts
     SET status = 'revision', revision_note = $1
     WHERE id = $2 AND status = 'delivered'
     RETURNING *`,
    [note, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ message: "Nothing has been delivered to send back" });
  }
  res.json(result.rows[0]);
}));

router.put("/:id/cancel", asyncHandler(async (req, res) => {
  const result = await db.query(
    `UPDATE contracts
     SET status = 'cancelled'
     WHERE id = $1 AND status <> 'approved'
     RETURNING *`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ message: "A finished contract cannot be cancelled" });
  }
  res.json(result.rows[0]);
}));

export default router;
