import { Router } from "express";
import { login, requireAuth } from "./auth.js";
import * as boxManager from "../services/box-manager.js";
import { config } from "../config.js";
import { getConfigValue, setConfigValue } from "../db/models/bot-config.js";

export function createWebRouter(): Router {
  const router = Router();

  // ── Auth ────────────────────────────────────────────────────────
  router.post("/auth/login", async (req, res) => {
    const { username, password } = req.body ?? {};
    const token = await login(username, password);

    if (!token) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      // Production runs behind HTTPS in webhook mode; only send the cookie
      // over secure connections there. Plain HTTP (local polling) keeps it off.
      secure: config.botMode === "webhook",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
  });

  router.post("/auth/logout", (_req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: config.botMode === "webhook",
    });
    res.json({ ok: true });
  });

  // ── Boxes ────────────────────────────────────────────────────────
  router.get("/boxes", requireAuth, async (_req, res) => {
    try {
      const boxes = await boxManager.listBoxes();
      res.json({ boxes });
    } catch (e) {
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.delete("/boxes/:id", requireAuth, async (req, res) => {
    try {
      await boxManager.deleteBox(req.params.id as string);
      res.json({ ok: true });
    } catch (e) {
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── Settings ─────────────────────────────────────────────────────
  router.get("/settings", requireAuth, async (_req, res) => {
    const boxKey = await getConfigValue(
      "UPSTASH_BOX_API_KEY",
      config.upstashBoxApiKey,
    );
    const agentKey = await getConfigValue("AGENT_API_KEY", config.agentApiKey);
    const allowedUsers = await getConfigValue("ALLOWED_USERS", "");

    res.json({
      botMode: config.botMode,
      adminUsername: config.adminUsername,
      upstashBoxApiKey: boxKey
        ? `${boxKey.slice(0, 6)}...${boxKey.slice(-4)}`
        : "",
      agentApiKey: agentKey
        ? `${agentKey.slice(0, 6)}...${agentKey.slice(-4)}`
        : "",
      allowedUsers,
    });
  });

  router.put("/settings", requireAuth, async (req, res) => {
    const { allowedUsers } = req.body ?? {};
    if (typeof allowedUsers === "string") {
      await setConfigValue("ALLOWED_USERS", allowedUsers);
    }
    res.json({ ok: true });
  });

  return router;
}
