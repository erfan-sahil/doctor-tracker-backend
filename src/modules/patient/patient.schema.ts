import { z } from "zod";

export function objectIdSchema(message = "Invalid id") {
  return z.string().regex(/^[a-f\d]{24}$/i, message);
}

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(isValidDateOnly, "Date must be YYYY-MM-DD");

const conditionSchema = z
  .string()
  .trim()
  .min(1, "Condition is required")
  .max(100, "Condition is too long");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long");

export const createPatientSchema = z.object({
  name: nameSchema,
  condition: z.union([conditionSchema, z.null()]).optional(),
  date: z.union([dateOnlySchema, z.null()]).optional(),
  doctorId: objectIdSchema().optional(),
});

export const patientParamsSchema = z.object({
  id: objectIdSchema(),
});

export const listPatientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).optional(),
  doctorId: objectIdSchema().optional(),
  condition: z.string().trim().min(1).optional(),
  date: dateOnlySchema.optional(),
});

export const updatePatientSchema = z
  .object({
    name: nameSchema.optional(),
    condition: z.union([conditionSchema, z.null()]).optional(),
    date: z.union([dateOnlySchema, z.null()]).optional(),
    doctorId: objectIdSchema().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.condition !== undefined ||
      value.date !== undefined ||
      value.doctorId !== undefined,
    { message: "At least one field is required" },
  );

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
