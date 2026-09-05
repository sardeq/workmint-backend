
export function addDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + Number(days));
    return date.toISOString().slice(0, 10);
}

export async function nextPosition(pgclient, orderId) {
    const result = await pgclient.query(
        "SELECT MAX(position) AS last FROM milestones WHERE order_id = $1",
        [orderId]
    );
    const last = result.rows[0].last;
    if (!last) {
        return 1;
    }
    return Number(last) + 1;
}
