import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import type { Request, Response, NextFunction } from "express";

export interface JwtPayload {
  username: string;
  iat: number;
}

/** Verify username/password and return a JWT. */
export async function login(
  username: string,
  password: string,
): Promise<string | null> {
  if (username !== config.adminUsername) return null;

  if (!config.adminPassword) return null;

  const stored = config.adminPassword;
  const looksHashed = /^\$2[aby]\$/.test(stored);
  const ok = looksHashed
    ? await bcrypt.compare(password, stored)
    : password === stored;
  if (!ok) return null;

  return jwt.sign(
    { username } satisfies Omit<JwtPayload, "iat">,
    config.jwtSecret,
    {
      expiresIn: "24h",
    },
  );
}

/** Express middleware that validates JWT from cookie or Authorization header. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token =
    req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
