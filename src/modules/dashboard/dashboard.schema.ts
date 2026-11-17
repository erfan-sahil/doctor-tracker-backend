import { z } from "zod";

import { dateOnlySchema } from "../patient/patient.schema.js";

export const dashboardQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    groupBy: z.enum(["day", "month"]).default("day"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must not be after to",
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
