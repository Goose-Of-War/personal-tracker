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
  },
  { timestamps: true } // createdAt (audit trail) is separate from `date` (user-editable), per spec
);

transactionSchema.index({ userId: 1, primaryAccount: 1, date: -1 });
transactionSchema.index({ userId: 1, date: -1 });

export default mongoose.model("Transaction", transactionSchema);
