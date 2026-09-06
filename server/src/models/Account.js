import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ["credit", "savings", "investment", "iou", "loan"] },
    // All monetary values stored as integers (smallest currency unit, e.g. paise/cents)
    balance: { type: Number, required: true, default: 0 },
    limit: { type: Number, default: null }, // only meaningful for type: 'credit'
    note: { type: String, default: "", trim: true },
    archived: { type: Boolean, default: false },
    // Client-generated idempotency key (retried POSTs reuse it so a create can
    // never double-write). Sparse-unique: most documents won't have one.
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, archived: 1 });
// Partial (not sparse) unique index: sparse indexes a stored null, so two
// keyless documents (e.g. server-generated balance corrections) would collide;
// a partial filter only indexes docs whose key is a real string.
accountSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.model("Account", accountSchema);
