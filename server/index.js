import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import db from "./db/db.js";
import userRoutes from "./routes/users.js";
import portfolioRoutes from "./routes/portfolio.js";
import jobRoutes from "./routes/jobs.js";
import proposalRoutes from "./routes/proposals.js";
import contractRoutes from "./routes/contracts.js";
import messageRoutes from "./routes/messages.js";
import paymentRoutes from "./routes/payments.js";
import paymentMethodRoutes from "./routes/paymentMethods.js";
import withdrawalRoutes from "./routes/withdrawals.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Workmint API is running");
});

app.use("/api/users", userRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/withdrawals", withdrawalRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

db.connect().then(() => {
  console.log("Connected to PostgreSQL");
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
