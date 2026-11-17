import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createDoctor,
  deleteDoctorHandler,
  getDoctorHandler,
  listDoctorPatientsHandler,
  listDoctorsHandler,
  updateDoctorHandler,
} from "./doctor.controller.js";
import {
  createDoctorSchema,
  doctorParamsSchema,
  listDoctorsQuerySchema,
  updateDoctorSchema,
} from "./doctor.schema.js";

export const doctorRouter = Router();

const adminOnly = [authenticate, authorize("admin")] as const;

doctorRouter.post("/", ...adminOnly, validate(createDoctorSchema), createDoctor);
doctorRouter.get("/", ...adminOnly, validate(listDoctorsQuerySchema, "query"), listDoctorsHandler);
doctorRouter.get(
  "/:id/patients",
  ...adminOnly,
  validate(doctorParamsSchema, "params"),
  listDoctorPatientsHandler,
);
doctorRouter.get(
  "/:id",
  ...adminOnly,
  validate(doctorParamsSchema, "params"),
  getDoctorHandler,
);
doctorRouter.patch(
  "/:id",
  ...adminOnly,
  validate(doctorParamsSchema, "params"),
  validate(updateDoctorSchema),
  updateDoctorHandler,
);
doctorRouter.delete(
  "/:id",
  ...adminOnly,
  validate(doctorParamsSchema, "params"),
  deleteDoctorHandler,
);
