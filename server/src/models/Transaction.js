import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, enum: ["deposit", "expense", "transfer"] },
    date: { type: Date, required: true }, // user-editable transaction date (can backdate)
    category: { type: String, default: "", trim: true },
    subCategory: { type: String, default: "", trim: true },
    primaryAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    // All amounts stored as integers (smallest currency unit), same convention as Account.balance
    primaryAmount: { type: Number, required: true },
    secondaryAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    secondaryAmount: { type: Number, default: null },
    note: { type: String, default: "", trim: true },
    // Client-generated idempotency key (retried POSTs reuse it so a create can
    // never double-write). Sparse-unique: most documents won't have one.
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true } // createdAt (audit trail) is separate from `date` (user-editable), per spec
);

transactionSchema.index({ userId: 1, primaryAccount: 1, date: -1 });
transactionSchema.index({ userId: 1, date: -1 });
// Partial (not sparse) unique index: sparse indexes a stored null, so two
// keyless documents (e.g. server-generated balance corrections) would collide;
// a partial filter only indexes docs whose key is a real string.
transactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.model("Transaction", transactionSchema);
