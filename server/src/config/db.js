import mongoose from "mongoose";

// Cached across warm serverless invocations (Vercel reuses the process
// between requests when it can). Local dev (server.js, calls this once at
// boot) is unaffected — it just gets a single cache hit for the app's
// lifetime, same as before.
let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set in environment variables");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((m) => {
      console.log("[db] connected to MongoDB");
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
