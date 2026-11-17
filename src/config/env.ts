import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const durationSchema = z
  .string()
  .regex(/^[1-9]\d*(s|m|h|d)$/, "Duration must look like 15m or 7d");

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
    ACCESS_TOKEN_SECRET: z
      .string()
      .min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
    REFRESH_TOKEN_SECRET: z
      .string()
      .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL: durationSchema.default("15m"),
    REFRESH_TOKEN_TTL: durationSchema.default("7d"),
    ADMIN_NAME: z.string().trim().min(1, "ADMIN_NAME is required"),
    ADMIN_EMAIL: z
      .string()
      .trim()
      .toLowerCase()
      .email("ADMIN_EMAIL must be a valid email"),
    ADMIN_PASSWORD: z
      .string()
      .min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  })
  .refine((data) => data.ACCESS_TOKEN_SECRET !== data.REFRESH_TOKEN_SECRET, {
    path: ["REFRESH_TOKEN_SECRET"],
    message: "REFRESH_TOKEN_SECRET must be different from ACCESS_TOKEN_SECRET",
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment variables:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;
