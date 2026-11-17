import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => env.NODE_ENV === "test",
      message: {
        success: false,
        message: "Too many requests",
      },
    }),
  );

  app.use(apiRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
