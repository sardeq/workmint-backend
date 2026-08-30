import express from "express";
import bcrypt from "bcryptjs";
import pgclient from "../db/db.js";

const userRoutes = express.Router();

// We never send password_hash back to the client, so every SELECT lists the
// columns it wants instead of using SELECT *.
const USER_COLUMNS = `id, name, email, role, status, company, title, bio,
                      skills, hourly_rate, available, location, rating, joined_at`;

// GET http://localhost:5000/api/users
// GET http://localhost:5000/api/users?role=freelancer&status=active
userRoutes.get("/", async (req, res) => {
    const { role, status } = req.query;
    try {
        const result = await pgclient.query(
            `SELECT ${USER_COLUMNS} FROM users
             WHERE ($1::text IS NULL OR role = $1)
               AND ($2::text IS NULL OR status = $2)
             ORDER BY id`,
            [role || null, status || null]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET http://localhost:5000/api/users/2
userRoutes.get("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/users     (register)
// { "name": "Amina", "email": "a@b.com", "password": "demo1234", "role": "freelancer" }
userRoutes.post("/", async (req, res) => {
    const { name, email, password, role, company, title } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: "name, email, password and role are required" });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    try {
        // Freelancers start as pending so an admin has to approve them first.
        const status = role === "freelancer" ? "pending" : "active";
        const hash = await bcrypt.hash(password, 10);

        const result = await pgclient.query(
            `INSERT INTO users (name, email, password_hash, role, status, company, title)
             VALUES ($1, LOWER($2), $3, $4, $5, $6, $7)
             RETURNING ${USER_COLUMNS}`,
            [name, email, hash, role, status, company || null, title || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        // 23505 is the unique violation on the email column
        if (err.code === "23505") {
            return res.status(409).json({ message: "An account already uses that email" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST http://localhost:5000/api/users/login
// { "email": "rana@techcorp.com", "password": "demo1234" }
userRoutes.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pgclient.query(
            "SELECT * FROM users WHERE email = LOWER($1)",
            [email]
        );
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
            return res.status(401).json({ message: "Wrong email or password" });
        }
        if (user.status === "pending") {
            return res.status(403).json({ message: "Your account is still being reviewed" });
        }
        if (user.status === "suspended") {
            return res.status(403).json({ message: "This account is suspended" });
        }

        delete user.password_hash;
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/users/2    (edit profile)
userRoutes.put("/:id", async (req, res) => {
    const { name, title, bio, skills, hourly_rate, available, location, company } = req.body;
    try {
        const result = await pgclient.query(
            `UPDATE users
             SET name = $1, title = $2, bio = $3, skills = $4,
                 hourly_rate = $5, available = $6, location = $7, company = $8
             WHERE id = $9
             RETURNING ${USER_COLUMNS}`,
            [name, title, bio, skills, hourly_rate, available, location, company, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT http://localhost:5000/api/users/7/status    (admin: approve / suspend)
// { "status": "active" }
userRoutes.put("/:id/status", async (req, res) => {
    const { status, reason } = req.body;
    if (!["active", "pending", "suspended"].includes(status)) {
        return res.status(400).json({ message: "status must be active, pending or suspended" });
    }
    try {
        const result = await pgclient.query(
            `UPDATE users SET status = $1, suspended_reason = $2
             WHERE id = $3 RETURNING ${USER_COLUMNS}`,
            [status, status === "suspended" ? reason : null, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE http://localhost:5000/api/users/7
userRoutes.delete("/:id", async (req, res) => {
    try {
        const result = await pgclient.query(
            "DELETE FROM users WHERE id = $1 RETURNING id, name, email",
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User deleted", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default userRoutes;