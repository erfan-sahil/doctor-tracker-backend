import type { UserRole } from "./user.model.js";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  doctorId: string | null;
  isActive: boolean;
};

type UserLike = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  doctorId?: { toString(): string } | null;
  isActive: boolean;
};

export function toPublicUser(user: UserLike): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    doctorId: user.doctorId ? user.doctorId.toString() : null,
    isActive: user.isActive,
  };
}
