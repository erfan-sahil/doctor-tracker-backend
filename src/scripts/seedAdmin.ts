import { pathToFileURL } from "node:url";

import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../modules/user/user.model.js";
import { logger } from "../utils/logger.js";
import { hashPassword } from "../utils/password.js";

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
}

export async function seedAdmin(): Promise<void> {
  await connectDb();

  try {
    const existing = await User.findOne({ email: env.ADMIN_EMAIL });

    if (existing) {
      logger.info("Admin account already exists");
      return;
    }

    await User.create({
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "admin",
      isActive: true,
    });

    logger.info({ email: env.ADMIN_EMAIL }, "Admin account created");
  } finally {
    await disconnectDb();
  }
}

if (isExecutedDirectly()) {
  seedAdmin().catch((error: unknown) => {
    logger.error({ err: error }, "Failed to seed admin");
    process.exit(1);
  });
}
