import { Router } from "express";

import { authRouter } from "../modules/auth/index.js";
import { dashboardRouter } from "../modules/dashboard/index.js";
import { doctorRouter } from "../modules/doctor/index.js";
import { patientRouter } from "../modules/patient/index.js";

const v1Router = Router();

v1Router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "ok", data: null });
});

v1Router.use("/auth", authRouter);
v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/doctors", doctorRouter);
v1Router.use("/patients", patientRouter);

export const apiRouter = Router();

apiRouter.use("/api/v1", v1Router);
