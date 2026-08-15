import crypto from "crypto";
import Session from "../models/Session.js";

const INACTIVITY_HOURS = Number(process.env.SESSION_INACTIVITY_HOURS || 6);
const COOKIE_NAME = "session_token";

// Generates a token in the format xxxxx-xxxx-xxxx-xx-xxxxx using cryptographically
// secure randomness (never Math.random).
function generateToken() {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segmentLengths = [5, 4, 4, 2, 5];
  const randomSegment = (len) => {
    const bytes = crypto.randomBytes(len);
    let out = "";
    for (let i = 0; i < len; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  };
  return segmentLengths.map(randomSegment).join("-");
}

function newExpiry() {
  return new Date(Date.now() + INACTIVITY_HOURS * 60 * 60 * 1000);
}

export async function createSession(userId) {
  const token = generateToken();
  await Session.create({ token, userId, expiresAt: newExpiry() });
  return token;
}

// Validates a token and, if valid, slides its expiry forward. Returns the userId
// or null if the session is missing/expired.
export async function validateAndRefreshSession(token) {
  if (!token) return null;
  const session = await Session.findOne({ token });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  session.expiresAt = newExpiry();
  await session.save();
  return session.userId;
}

export async function destroySession(token) {
  if (!token) return;
  await Session.deleteOne({ token });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    maxAge: INACTIVITY_HOURS * 60 * 60 * 1000,
  };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
