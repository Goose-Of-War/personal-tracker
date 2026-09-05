import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: "INR", trim: true, uppercase: true },
    themeAccent: {
      type: String,
      enum: ["default", "ocean", "forest", "ember", "magenta", "lavender", "twilight", "hazel", "bw"],
      default: "default",
    },
    themeMode: { type: String, enum: ["light", "dark"], default: "light" },
    categories: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          subCategories: { type: [String], default: [] },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
