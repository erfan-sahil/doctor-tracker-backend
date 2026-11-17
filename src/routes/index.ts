import { Router } from "express";

import { authRouter } from "../modules/auth/index.js";
import { doctorRouter } from "../modules/doctor/index.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/doctors", doctorRouter);

export const apiRouter = Router();

apiRouter.use("/api/v1", v1Router);
