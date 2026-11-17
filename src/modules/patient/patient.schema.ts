import { z } from "zod";

export function objectIdSchema(message = "Invalid id") {
  return z.string().regex(/^[a-f\d]{24}$/i, message);
}
