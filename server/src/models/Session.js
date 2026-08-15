import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index: auto-delete on expiry
});

export default mongoose.model("Session", sessionSchema);
