import type { UserRole } from "../modules/user/user.model.js";

export type AuthUser = {
  id: string;
  role: UserRole;
  doctorId?: string;
};
