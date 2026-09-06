import db from "./db/db.js";

export function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

export async function nextPosition(orderId) {
  const result = await db.query(
    "SELECT MAX(position) AS last FROM milestones WHERE order_id = $1",
    [orderId]
  );
  return Number(result.rows[0].last || 0) + 1;
}

export async function addActivity(orderId, actor, text) {
  await db.query(
    "INSERT INTO activity (order_id, actor, text) VALUES ($1, $2, $3)",
    [orderId, actor, text]
  );
}
