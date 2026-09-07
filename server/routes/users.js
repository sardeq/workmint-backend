import express from "express";
import db from "../db/db.js";
import asyncHandler from "../middleware/asyncHandler.js";
import adminOnly from "../middleware/adminOnly.js";

const router = express.Router();

const COLUMNS = `id, name, email, role, status, company, title, bio, skills,
                 hourly_rate, available, rating, location, suspended_reason, joined_at`;

router.get("/", asyncHandler(async (req, res) => {
  const { role } = req.query;

  if (role) {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM users WHERE role = $1 AND status = 'active' ORDER BY rating DESC`,
      [role]
    );
    return res.json(result.rows);
  }

  const result = await db.query(`SELECT ${COLUMNS} FROM users ORDER BY id`);
  res.json(result.rows);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(result.rows[0]);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, email, password, role, company, title } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "name, email, password and role are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const taken = await db.query("SELECT id FROM users WHERE email = LOWER($1)", [email]);
  if (taken.rows.length > 0) {
    return res.status(409).json({ message: "An account already uses that email" });
  }

  const status = role === "freelancer" ? "pending" : "active";

  const result = await db.query(
    `INSERT INTO users (name, email, password, role, status, company, title)
     VALUES ($1, LOWER($2), $3, $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [name, email, password, role, status, company || null, title || null]
  );

  res.status(201).json(result.rows[0]);
}));

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await db.query(
    `SELECT ${COLUMNS} FROM users WHERE email = LOWER($1) AND password = $2`,
    [email, password]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ message: "Wrong email or password" });
  }

  const user = result.rows[0];

  if (user.status === "pending") {
    return res.status(403).json({ message: "Your account is still being reviewed" });
  }
  if (user.status === "suspended") {
    return res.status(403).json({ message: "This account is suspended" });
  }

  res.json(user);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, title, bio, skills, hourly_rate, available, location, company } = req.body;

  const result = await db.query(
    `UPDATE users
     SET name = $1, title = $2, bio = $3, skills = $4,
         hourly_rate = $5, available = $6, location = $7, company = $8
     WHERE id = $9
     RETURNING ${COLUMNS}`,
    [name, title, bio, skills, hourly_rate, available, location, company, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(result.rows[0]);
}));

router.put("/:id/status", adminOnly, asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  if (!["active", "pending", "suspended"].includes(status)) {
    return res.status(400).json({ message: "status must be active, pending or suspended" });
  }

  const result = await db.query(
    `UPDATE users SET status = $1, suspended_reason = $2 WHERE id = $3 RETURNING ${COLUMNS}`,
    [status, status === "suspended" ? reason : null, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(result.rows[0]);
}));

router.delete("/:id", adminOnly, asyncHandler(async (req, res) => {
  const result = await db.query(
    "DELETE FROM users WHERE id = $1 RETURNING id, name, email",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json({ message: "User deleted", user: result.rows[0] });
}));

export default router;
