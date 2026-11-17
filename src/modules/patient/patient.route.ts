import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createPatientHandler,
  deletePatientHandler,
  getPatientHandler,
  listPatientFilterOptionsHandler,
  listPatientsHandler,
  updatePatientHandler,
} from "./patient.controller.js";
import {
  createPatientSchema,
  listPatientsQuerySchema,
  patientParamsSchema,
  updatePatientSchema,
} from "./patient.schema.js";

export const patientRouter = Router();

const staff = [authenticate, authorize("admin", "doctor")] as const;

patientRouter.post("/", ...staff, validate(createPatientSchema), createPatientHandler);
patientRouter.get(
  "/",
  ...staff,
  validate(listPatientsQuerySchema, "query"),
  listPatientsHandler,
);
patientRouter.get("/filters", ...staff, listPatientFilterOptionsHandler);
patientRouter.get(
  "/:id",
  ...staff,
  validate(patientParamsSchema, "params"),
  getPatientHandler,
);
patientRouter.patch(
  "/:id",
  ...staff,
  validate(patientParamsSchema, "params"),
  validate(updatePatientSchema),
  updatePatientHandler,
);
patientRouter.delete(
  "/:id",
  ...staff,
  validate(patientParamsSchema, "params"),
  deletePatientHandler,
);
