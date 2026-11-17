import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { login, logout, me, refresh } from "./auth.controller.js";
import { loginSchema } from "./auth.schema.js";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many requests",
  },
});

export const authRouter = Router();

authRouter.post("/login", authRateLimiter, validate(loginSchema), login);
authRouter.post("/refresh", authRateLimiter, refresh);
authRouter.get("/me", authenticate, me);
authRouter.post("/logout", logout);
