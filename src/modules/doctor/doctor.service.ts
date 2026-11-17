import mongoose, { type ClientSession } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { isDuplicateKeyError, isTransactionUnsupported } from "../../utils/mongo.js";
import { hashPassword } from "../../utils/password.js";
import { toPublicUser, type PublicUser } from "../user/user.mapper.js";
import { User, type UserDocument } from "../user/user.model.js";
import { Patient } from "../patient/patient.model.js";
import { toDateOnly, toPatient, type PatientResponse } from "../patient/patient.service.js";
import type {
  CreateDoctorInput,
  ListDoctorsQuery,
  UpdateDoctorInput,
} from "./doctor.schema.js";
import { Doctor, type DoctorDocument } from "./doctor.model.js";

export type DoctorResponse = {
  id: string;
  name: string;
  phone: string;
  specialization: string | null;
  hospital: string | null;
};

export type DoctorAccount = {
  doctor: DoctorResponse;
  user: PublicUser;
};

export type DoctorWithUser = {
  doctor: DoctorResponse;
  user: PublicUser;
};

export type PaginatedDoctors = {
  doctors: DoctorWithUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DoctorFilterOptions = {
  specializations: string[];
  hospitals: string[];
};

type CreatedAccount = {
  doctor: DoctorDocument;
  user: UserDocument;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDoctor(doctor: DoctorDocument): DoctorResponse {
  return {
    id: doctor.id,
    name: doctor.name,
    phone: doctor.phone,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
  };
}

function toDoctorAccount(created: CreatedAccount): DoctorAccount {
  return {
    doctor: toDoctor(created.doctor),
    user: toPublicUser(created.user),
  };
}

function toDoctorWithUser(doctor: DoctorDocument, user: UserDocument): DoctorWithUser {
  return {
    doctor: toDoctor(doctor),
    user: toPublicUser(user),
  };
}

async function requireDoctor(doctorId: string): Promise<DoctorDocument> {
  const doctor = await Doctor.findById(doctorId);

  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  return doctor;
}

async function requireDoctorUser(doctorId: string): Promise<UserDocument> {
  const user = await User.findOne({ role: "doctor", doctorId });

  if (!user) {
    throw new ApiError(404, "Doctor not found");
  }

  return user;
}

type DoctorListFilter = {
  specialization?: RegExp;
  hospital?: RegExp;
  createdAt?: { $gte?: Date; $lt?: Date };
  $or?: Array<
    { name: RegExp } | { phone: RegExp } | { specialization: RegExp } | { hospital: RegExp }
  >;
};

function buildDoctorListFilter(query: ListDoctorsQuery): DoctorListFilter {
  const filter: DoctorListFilter = {};

  if (query.specialization) {
    filter.specialization = new RegExp(`^${escapeRegex(query.specialization)}$`, "i");
  }

  if (query.hospital) {
    filter.hospital = new RegExp(`^${escapeRegex(query.hospital)}$`, "i");
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { name: pattern },
      { phone: pattern },
      { specialization: pattern },
      { hospital: pattern },
    ];
  }

  if (query.createdFrom || query.createdTo) {
    const createdAt: { $gte?: Date; $lt?: Date } = {};

    if (query.createdFrom) {
      createdAt.$gte = toDateOnly(query.createdFrom);
    }

    if (query.createdTo) {
      const end = toDateOnly(query.createdTo);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.$lt = end;
    }

    filter.createdAt = createdAt;
  }

  return filter;
}

async function saveDoctorAccount(
  input: CreateDoctorInput,
  passwordHash: string,
  session?: ClientSession,
): Promise<CreatedAccount> {
  const doctor = new Doctor({
    name: input.name,
    phone: input.phone,
    specialization: input.specialization ?? null,
    hospital: input.hospital ?? null,
  });
  await doctor.save(session ? { session } : undefined);

  try {
    const user = new User({
      name: input.name,
      email: input.email,
      passwordHash,
      role: "doctor",
      doctorId: doctor._id,
      isActive: true,
    });
    await user.save(session ? { session } : undefined);

    return { doctor, user };
  } catch (error) {
    if (!session) {
      await Doctor.deleteOne({ _id: doctor._id });
    }

    throw error;
  }
}

async function createInTransaction(
  input: CreateDoctorInput,
  passwordHash: string,
): Promise<CreatedAccount> {
  const session = await mongoose.startSession();

  try {
    const created = await session.withTransaction(() =>
      saveDoctorAccount(input, passwordHash, session),
    );

    if (!created) {
      throw new Error("Failed to create doctor account");
    }

    return created;
  } finally {
    await session.endSession();
  }
}

export async function createDoctorAccount(
  input: CreateDoctorInput,
): Promise<DoctorAccount> {
  const passwordHash = await hashPassword(input.password);

  try {
    const created = await createInTransaction(input, passwordHash);
    return toDoctorAccount(created);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "Email already in use");
    }

    if (!isTransactionUnsupported(error)) {
      throw error;
    }
  }

  try {
    const created = await saveDoctorAccount(input, passwordHash);
    return toDoctorAccount(created);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "Email already in use");
    }

    throw error;
  }
}

function sortDistinctValues(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .sort((left, right) => left.localeCompare(right));
}

export async function getDoctorFilterOptions(): Promise<DoctorFilterOptions> {
  const [specializations, hospitals] = await Promise.all([
    Doctor.distinct("specialization"),
    Doctor.distinct("hospital"),
  ]);

  return {
    specializations: sortDistinctValues(specializations),
    hospitals: sortDistinctValues(hospitals),
  };
}

export async function listDoctors(query: ListDoctorsQuery): Promise<PaginatedDoctors> {
  const filter = buildDoctorListFilter(query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, doctors] = await Promise.all([
    Doctor.countDocuments(filter),
    Doctor.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
  ]);

  const doctorIds = doctors.map((doctor) => doctor._id);
  const users = await User.find({
    role: "doctor",
    doctorId: { $in: doctorIds },
  });

  const usersByDoctorId = new Map(
    users.map((user) => [user.doctorId?.toString() ?? "", user]),
  );

  const doctorsWithUsers = doctors.map((doctor) => {
    const user = usersByDoctorId.get(doctor.id);

    if (!user) {
      throw new ApiError(500, "Doctor account is incomplete");
    }

    return toDoctorWithUser(doctor, user);
  });

  return {
    doctors: doctorsWithUsers,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getDoctorById(doctorId: string): Promise<DoctorWithUser> {
  const doctor = await requireDoctor(doctorId);
  const user = await requireDoctorUser(doctorId);
  return toDoctorWithUser(doctor, user);
}

export async function updateDoctor(
  doctorId: string,
  input: UpdateDoctorInput,
): Promise<DoctorWithUser> {
  const doctor = await requireDoctor(doctorId);
  const user = await requireDoctorUser(doctorId);

  if (input.name !== undefined) {
    doctor.name = input.name;
    user.name = input.name;
  }

  if (input.phone !== undefined) {
    doctor.phone = input.phone;
  }

  if (input.specialization !== undefined) {
    doctor.specialization = input.specialization;
  }

  if (input.hospital !== undefined) {
    doctor.hospital = input.hospital;
  }

  await doctor.save();
  await user.save();

  return toDoctorWithUser(doctor, user);
}

async function deleteDoctorAccount(
  doctorId: mongoose.Types.ObjectId,
  session?: ClientSession,
): Promise<void> {
  const deleteOptions = session ? { session } : undefined;
  await User.deleteOne({ role: "doctor", doctorId }, deleteOptions);
  await Doctor.deleteOne({ _id: doctorId }, deleteOptions);
}

async function deleteInTransaction(doctorId: mongoose.Types.ObjectId): Promise<void> {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(() => deleteDoctorAccount(doctorId, session));
  } finally {
    await session.endSession();
  }
}

export async function deleteDoctor(doctorId: string): Promise<void> {
  const doctor = await requireDoctor(doctorId);
  const objectId = doctor._id;

  const patientCount = await Patient.countDocuments({ doctorId: objectId });

  if (patientCount > 0) {
    throw new ApiError(409, "Doctor has assigned patients");
  }

  try {
    await deleteInTransaction(objectId);
  } catch (error) {
    if (!isTransactionUnsupported(error)) {
      throw error;
    }

    await deleteDoctorAccount(objectId);
  }
}

export async function listDoctorPatients(doctorId: string): Promise<PatientResponse[]> {
  await requireDoctor(doctorId);

  const patients = await Patient.find({ doctorId }).sort({ _id: -1 });
  return patients.map(toPatient);
}
