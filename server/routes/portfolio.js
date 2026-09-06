import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }

  const result = await db.query(
    "SELECT * FROM portfolio_items WHERE user_id = $1 ORDER BY created_at",
    [user_id]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { user_id, title, tech, link, description } = req.body;

  if (!user_id || !title || !description) {
    return res.status(400).json({ message: "user_id, title and description are required" });
  }

  const result = await db.query(
    `INSERT INTO portfolio_items (user_id, title, tech, link, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [user_id, title, tech || [], link || null, description]
  );

  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const { title, tech, link, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ message: "title and description are required" });
  }

  const result = await db.query(
    `UPDATE portfolio_items SET title = $1, tech = $2, link = $3, description = $4
     WHERE id = $5 RETURNING *`,
    [title, tech || [], link || null, description, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Portfolio item not found" });
  }
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await db.query(
    "DELETE FROM portfolio_items WHERE id = $1 RETURNING *",
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Portfolio item not found" });
  }
  res.json({ message: "Portfolio item removed", item: result.rows[0] });
});

export default router;
