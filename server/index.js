import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import pgclient from "./db/db.js";
import userRoutes from "./routes/users.js";
import jobRoutes from "./routes/jobs.js";
import proposalRoutes from "./routes/proposals.js";
import orderRoutes from "./routes/orders.js";
import milestoneRoutes from "./routes/milestones.js";
import messageRoutes from "./routes/messages.js";
import disputeRoutes from "./routes/disputes.js";

const app = express();
dotenv.config();

// Middlewares
app.use(cors()); // open for anyone
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("Welcome to the Workmint API server");
});

app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/disputes", disputeRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

pgclient.connect().then(() => {
    console.log("Connected to PostgreSQL");
    app.listen(PORT, () => {
        console.log(`Listening on PORT ${PORT}`);
    });
});