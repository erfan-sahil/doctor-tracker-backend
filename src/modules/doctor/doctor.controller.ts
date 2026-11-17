import type { Request } from "express";

import { ApiError } from "../../utils/ApiError.js";
import { apiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createDoctorAccount,
  deleteDoctor,
  getDoctorById,
  listDoctorPatients,
  listDoctors,
  updateDoctor,
} from "./doctor.service.js";
import type { ListDoctorsQuery } from "./doctor.schema.js";

function routeId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  return id;
}

export const createDoctor = asyncHandler(async (req, res) => {
  const account = await createDoctorAccount(req.body);
  res.status(201).json(apiResponse("Doctor account created", account));
});

export const listDoctorsHandler = asyncHandler(async (req, res) => {
  const result = await listDoctors(req.query as unknown as ListDoctorsQuery);
  res.status(200).json(apiResponse("Doctors retrieved", result));
});

export const getDoctorHandler = asyncHandler(async (req, res) => {
  const doctor = await getDoctorById(routeId(req));
  res.status(200).json(apiResponse("Doctor retrieved", doctor));
});

export const updateDoctorHandler = asyncHandler(async (req, res) => {
  const doctor = await updateDoctor(routeId(req), req.body);
  res.status(200).json(apiResponse("Doctor updated", doctor));
});

export const deleteDoctorHandler = asyncHandler(async (req, res) => {
  await deleteDoctor(routeId(req));
  res.status(200).json(apiResponse("Doctor deleted", null));
});

export const listDoctorPatientsHandler = asyncHandler(async (req, res) => {
  const patients = await listDoctorPatients(routeId(req));
  res.status(200).json(apiResponse("Patients retrieved", patients));
});
