import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that requires an authenticated session with a valid userId.
 * Returns 401 if the user is not logged in or their session lacks a userId.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.authenticated || !req.session?.userId) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }
  next();
}
