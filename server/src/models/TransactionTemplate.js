import mongoose from "mongoose";

// Reusable transaction "blueprints" (§None — templates feature). Same field
// shape as a transaction minus `date` (a new transaction always starts today)
// plus a user-facing `name`. Amounts follow the integer-smallest-unit
// convention used everywhere else.
const templateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ["deposit", "expense", "transfer"] },
    category: { type: String, default: "", trim: true },
    subCategory: { type: String, default: "", trim: true },
    primaryAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    primaryAmount: { type: Number, required: true },
    secondaryAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    secondaryAmount: { type: Number, default: null },
    note: { type: String, default: "", trim: true },
    // Client-generated idempotency key (retried POSTs reuse it so a create can
    // never double-write). Sparse-unique: most documents won't have one.
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

templateSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("TransactionTemplate", templateSchema);