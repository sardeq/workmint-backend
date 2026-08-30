import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pgclient = new pg.Client(process.env.DATABASE_URL);

pgclient.on("error", (err) => console.error(err));

export default pgclient;