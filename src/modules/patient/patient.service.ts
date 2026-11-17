import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import type { AuthUser } from "../../types/auth.js";
import { Doctor } from "../doctor/doctor.model.js";
import type {
  CreatePatientInput,
  ListPatientsQuery,
  UpdatePatientInput,
} from "./patient.schema.js";
import { Patient, type PatientDocument } from "./patient.model.js";

export type PatientResponse = {
  id: string;
  name: string;
  doctorId: string;
  condition: string | null;
  date: string | null;
};

export type PaginatedPatients = {
  patients: PatientResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PatientFilterOptions = {
  conditions: string[];
};

type PatientListFilter = {
  doctorId?: string;
  condition?: RegExp;
  name?: RegExp;
  date?: { $gte: Date; $lt: Date };
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortDistinctValues(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .sort((left, right) => left.localeCompare(right));
}

export function toDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const year = match?.[1];
  const month = match?.[2];
  const day = match?.[3];

  if (!year || !month || !day) {
    throw new ApiError(400, "Date must be YYYY-MM-DD");
  }

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toPatient(patient: PatientDocument): PatientResponse {
  return {
    id: patient.id,
    name: patient.name,
    doctorId: patient.doctorId.toString(),
    condition: patient.condition ?? null,
    date: patient.date ? formatDateOnly(patient.date) : null,
  };
}

async function requireDoctor(doctorId: string): Promise<void> {
  const doctor = await Doctor.findById(doctorId);

  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }
}

function requireActorDoctorId(actor: AuthUser): string {
  if (actor.role !== "doctor" || !actor.doctorId) {
    throw new ApiError(403, "Forbidden");
  }

  return actor.doctorId;
}

function resolveAssignedDoctorId(actor: AuthUser, doctorId: string | undefined): string {
  if (actor.role === "doctor") {
    const ownDoctorId = requireActorDoctorId(actor);

    if (doctorId && doctorId !== ownDoctorId) {
      throw new ApiError(403, "Forbidden");
    }

    return ownDoctorId;
  }

  if (!doctorId) {
    throw new ApiError(400, "Doctor is required");
  }

  return doctorId;
}

async function findVisiblePatient(
  actor: AuthUser,
  patientId: string,
): Promise<PatientDocument> {
  const patient = await Patient.findById(patientId);

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  if (actor.role === "doctor" && patient.doctorId.toString() !== actor.doctorId) {
    throw new ApiError(404, "Patient not found");
  }

  return patient;
}

function buildPatientListFilter(
  actor: AuthUser,
  query: ListPatientsQuery,
): PatientListFilter {
  const filter: PatientListFilter = {};

  if (actor.role === "doctor") {
    const doctorId = requireActorDoctorId(actor);

    if (query.doctorId && query.doctorId !== doctorId) {
      throw new ApiError(403, "Forbidden");
    }

    filter.doctorId = doctorId;
  } else if (query.doctorId) {
    filter.doctorId = query.doctorId;
  }

  if (query.condition) {
    filter.condition = new RegExp(`^${escapeRegex(query.condition)}$`, "i");
  }

  if (query.search) {
    filter.name = new RegExp(escapeRegex(query.search), "i");
  }

  if (query.date) {
    const start = toDateOnly(query.date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    filter.date = { $gte: start, $lt: end };
  }

  return filter;
}

export async function createPatient(
  actor: AuthUser,
  input: CreatePatientInput,
): Promise<PatientResponse> {
  const doctorId = resolveAssignedDoctorId(actor, input.doctorId);
  await requireDoctor(doctorId);

  const patient = await Patient.create({
    name: input.name,
    doctorId,
    condition: input.condition ?? null,
    date: input.date ? toDateOnly(input.date) : null,
  });

  return toPatient(patient);
}

export async function getPatientFilterOptions(actor: AuthUser): Promise<PatientFilterOptions> {
  const conditionScope =
    actor.role === "doctor"
      ? { doctorId: new Types.ObjectId(requireActorDoctorId(actor)) }
      : {};

  const conditions = await Patient.distinct("condition", conditionScope);

  return {
    conditions: sortDistinctValues(conditions),
  };
}

export async function listPatients(
  actor: AuthUser,
  query: ListPatientsQuery,
): Promise<PaginatedPatients> {
  const filter = buildPatientListFilter(actor, query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, patients] = await Promise.all([
    Patient.countDocuments(filter),
    Patient.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
  ]);

  return {
    patients: patients.map(toPatient),
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getPatient(
  actor: AuthUser,
  patientId: string,
): Promise<PatientResponse> {
  const patient = await findVisiblePatient(actor, patientId);
  return toPatient(patient);
}

export async function updatePatient(
  actor: AuthUser,
  patientId: string,
  input: UpdatePatientInput,
): Promise<PatientResponse> {
  const patient = await findVisiblePatient(actor, patientId);

  if (actor.role === "doctor" && input.doctorId !== undefined) {
    throw new ApiError(403, "Forbidden");
  }

  if (input.name !== undefined) {
    patient.name = input.name;
  }

  if (input.condition !== undefined) {
    patient.condition = input.condition;
  }

  if (input.date !== undefined) {
    patient.date = input.date ? toDateOnly(input.date) : null;
  }

  if (actor.role === "admin" && input.doctorId !== undefined) {
    await requireDoctor(input.doctorId);
    patient.doctorId = new Types.ObjectId(input.doctorId);
  }

  await patient.save();
  return toPatient(patient);
}

export async function deletePatient(actor: AuthUser, patientId: string): Promise<void> {
  const patient = await findVisiblePatient(actor, patientId);
  await patient.deleteOne();
}
