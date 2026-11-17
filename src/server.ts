import type { Server } from "node:http";

import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const shutdownTimeoutMs = 10_000;

async function shutdown(server: Server, signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Forced shutdown"));
    }, shutdownTimeoutMs);
    timeout.unref();

    server.close((error) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  await disconnectDb();
}

async function start(): Promise<void> {
  try {
    await connectDb();
  } catch (error) {
    logger.error({ err: error }, "Failed to connect to MongoDB");
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });

  let shuttingDown = false;

  const handleSignal = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    shutdown(server, signal)
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Shutdown failed");
        process.exit(1);
      });
  };

  process.on("SIGINT", () => {
    handleSignal("SIGINT");
  });
  process.on("SIGTERM", () => {
    handleSignal("SIGTERM");
  });
}

void start();
