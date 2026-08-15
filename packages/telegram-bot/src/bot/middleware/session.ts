import type { Context, NextFunction } from "grammy";
import { getSession, touchActivity } from "../../services/session-store.js";
import type { ISession } from "../../db/models/session.js";

/** Extended context with user session. */
export interface BotContext extends Context {
  session: ISession;
}

/** Middleware that loads the user session into ctx.session. */
export async function sessionMiddleware(
  ctx: BotContext,
  next: NextFunction,
): Promise<void> {
  const userId = ctx.from?.id?.toString();
  if (!userId) {
    await next();
    return;
  }

  ctx.session = await getSession(userId);
  await touchActivity(userId);
  await next();
}
