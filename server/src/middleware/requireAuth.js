import { validateAndRefreshSession, SESSION_COOKIE_NAME, cookieOptions } from "../lib/session.js";

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const userId = await validateAndRefreshSession(token);
  if (!userId) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Re-set the cookie so the browser's own expiry also slides forward.
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
  req.userId = userId;
  next();
}
