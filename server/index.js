import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import db from "./db/db.js";
import userRoutes from "./routes/users.js";
import jobRoutes from "./routes/jobs.js";
import proposalRoutes from "./routes/proposals.js";
import orderRoutes from "./routes/orders.js";
import milestoneRoutes from "./routes/milestones.js";
import messageRoutes from "./routes/messages.js";
import disputeRoutes from "./routes/disputes.js";
import portfolioRoutes from "./routes/portfolio.js";
import withdrawalRoutes from "./routes/withdrawals.js";
import paymentMethodRoutes from "./routes/paymentMethods.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Workmint API is running");
});

app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);

db.connect().then(() => {
  console.log("Connected to PostgreSQL");
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
