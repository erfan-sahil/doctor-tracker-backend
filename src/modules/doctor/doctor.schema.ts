import { z } from "zod";

import { objectIdSchema } from "../patient/patient.schema.js";

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .max(30, "Phone is too long")
  .regex(/^[\d\s+().-]+$/, "Enter a valid phone number");

export const createDoctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
  specialization: z
    .string()
    .trim()
    .min(1, "Specialization is required")
    .max(100, "Specialization is too long")
    .optional(),
  hospital: z
    .string()
    .trim()
    .min(1, "Hospital is required")
    .max(100, "Hospital is too long")
    .optional(),
});

export const doctorParamsSchema = z.object({
  id: objectIdSchema(),
});

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).optional(),
  specialization: z.string().trim().min(1).optional(),
  hospital: z.string().trim().min(1).optional(),
});

export const updateDoctorSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long").optional(),
    specialization: z
      .union([
        z
          .string()
          .trim()
          .min(1, "Specialization is required")
          .max(100, "Specialization is too long"),
        z.null(),
      ])
      .optional(),
    hospital: z
      .union([
        z.string().trim().min(1, "Hospital is required").max(100, "Hospital is too long"),
        z.null(),
      ])
      .optional(),
    phone: phoneSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.phone !== undefined ||
      value.specialization !== undefined ||
      value.hospital !== undefined,
    { message: "At least one field is required" },
  );

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
