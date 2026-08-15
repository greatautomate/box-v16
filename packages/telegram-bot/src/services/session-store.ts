import { Session, type ISession } from "../db/models/session.js";

export async function getSession(telegramId: string): Promise<ISession> {
  // Atomic upsert avoids a duplicate-key race when two updates for the same
  // user arrive concurrently (e.g. rapid messages or webhook retries).
  return Session.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { telegramId } },
    { new: true, upsert: true },
  );
}

export async function updateSession(
  telegramId: string,
  update: Partial<
    Pick<
      ISession,
      | "activeBoxId"
      | "defaultModel"
      | "defaultHarness"
      | "defaultRuntime"
      | "uploadDestination"
      | "wizardSize"
      | "wizardApiKeyType"
      | "defaultKeepAlive"
      | "wizardKeepAlive"
      | "lastActivityAt"
    >
  >,
): Promise<ISession> {
  const session = await Session.findOneAndUpdate(
    { telegramId },
    { $set: update },
    { new: true, upsert: true },
  );
  return session;
}

export async function touchActivity(telegramId: string): Promise<void> {
  await Session.findOneAndUpdate(
    { telegramId },
    { $set: { lastActivityAt: new Date() } },
  );
}
