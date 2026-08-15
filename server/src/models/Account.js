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
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, archived: 1 });

export default mongoose.model("Account", accountSchema);
