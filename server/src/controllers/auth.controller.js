import bcrypt from "bcrypt";
import User from "../models/User.js";
import { createSession, destroySession, SESSION_COOKIE_NAME, cookieOptions } from "../lib/session.js";

const SALT_ROUNDS = 12;

// Default categories seeded for every new signup (§1a of the spec - the exact
// default list was left TBD there; this is a starting-point guess, flagged in
// claude-records.log for you to confirm or replace).
const DEFAULT_CATEGORIES = [
  { name: "Food", subCategories: ["Groceries", "Dining out"] },
  { name: "Transport", subCategories: ["Fuel", "Public transit", "Taxi/Rideshare"] },
  { name: "Bills & Utilities", subCategories: ["Rent", "Electricity", "Internet", "Phone"] },
  { name: "Shopping", subCategories: ["Clothing", "Electronics", "Household"] },
  { name: "Health", subCategories: ["Pharmacy", "Doctor"] },
  { name: "Entertainment", subCategories: [] },
  { name: "Income", subCategories: ["Salary", "Interest"] },
  { name: "Correction", subCategories: [] },
  { name: "Other", subCategories: [] },
];

export async function signup(req, res) {
  const { name, username, password, confirmPassword } = req.body;

  if (!name || !username || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await User.findOne({ username: username.toLowerCase().trim() });
  if (existing) {
    return res.status(409).json({ error: "Username is already taken" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name: name.trim(),
    username: username.trim(),
    passwordHash,
    categories: DEFAULT_CATEGORIES,
  });

  const token = await createSession(user._id);
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
  res.status(201).json({ id: user._id, name: user.name, username: user.username, categories: user.categories });
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = await createSession(user._id);
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
  res.json({ id: user._id, name: user.name, username: user.username, categories: user.categories });
}

export async function logout(req, res) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  await destroySession(token);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).end();
}

export async function me(req, res) {
  const user = await User.findById(req.userId).select("name username categories");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user._id, name: user.name, username: user.username, categories: user.categories });
}

// Replaces the user's whole categories list (Profile page). Whether removing a
// category/subCategory still referenced by existing transactions should be blocked
// is an open decision (see readme) - currently allowed silently; those transactions
// simply keep their existing (now unlisted) category/subCategory text untouched.
export async function updateCategories(req, res) {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: "categories must be an array" });
  }
  for (const c of categories) {
    if (!c || typeof c.name !== "string" || !c.name.trim()) {
      return res.status(400).json({ error: "each category needs a non-empty name" });
    }
    if (!Array.isArray(c.subCategories) || c.subCategories.some((s) => typeof s !== "string")) {
      return res.status(400).json({ error: `subCategories for "${c.name}" must be an array of strings` });
    }
  }
  const names = categories.map((c) => c.name.trim());
  if (new Set(names).size !== names.length) {
    return res.status(400).json({ error: "category names must be unique" });
  }

  const cleaned = categories.map((c) => ({
    name: c.name.trim(),
    subCategories: [...new Set(c.subCategories.map((s) => s.trim()).filter(Boolean))],
  }));

  const user = await User.findByIdAndUpdate(req.userId, { categories: cleaned }, { new: true }).select("categories");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ categories: user.categories });
}
