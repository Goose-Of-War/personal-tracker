// Vercel serverless entrypoint. Wraps the existing Express app (unchanged)
// instead of duplicating routing/middleware logic here. server/src/server.js
// (app.listen()) stays the local-dev entrypoint and is untouched by this file.
import "dotenv/config";
import app from "../server/src/app.js";
import { connectDB } from "../server/src/config/db.js";

export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}
