import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getDashboardHandler } from "./dashboard.controller.js";
import { dashboardQuerySchema } from "./dashboard.schema.js";

export const dashboardRouter = Router();

const staff = [authenticate, authorize("admin", "doctor")] as const;

dashboardRouter.get(
  "/",
  ...staff,
  validate(dashboardQuerySchema, "query"),
  getDashboardHandler,
);
