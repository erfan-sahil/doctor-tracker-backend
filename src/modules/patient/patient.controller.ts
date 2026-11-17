import type { Request } from "express";

import { requireUser } from "../../middlewares/authenticate.middleware.js";
import { ApiError } from "../../utils/ApiError.js";
import { apiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import type { ListPatientsQuery } from "./patient.schema.js";
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  updatePatient,
} from "./patient.service.js";

function routeId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  return id;
}

export const createPatientHandler = asyncHandler(async (req, res) => {
  const patient = await createPatient(requireUser(req), req.body);
  res.status(201).json(apiResponse("Patient created", patient));
});

export const listPatientsHandler = asyncHandler(async (req, res) => {
  const result = await listPatients(
    requireUser(req),
    req.query as unknown as ListPatientsQuery,
  );
  res.status(200).json(apiResponse("Patients retrieved", result));
});

export const getPatientHandler = asyncHandler(async (req, res) => {
  const patient = await getPatient(requireUser(req), routeId(req));
  res.status(200).json(apiResponse("Patient retrieved", patient));
});

export const updatePatientHandler = asyncHandler(async (req, res) => {
  const patient = await updatePatient(requireUser(req), routeId(req), req.body);
  res.status(200).json(apiResponse("Patient updated", patient));
});

export const deletePatientHandler = asyncHandler(async (req, res) => {
  await deletePatient(requireUser(req), routeId(req));
  res.status(200).json(apiResponse("Patient deleted", null));
});
