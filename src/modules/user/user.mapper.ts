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
  id?: string;
  _id?: { toString(): string };
  name: string;
  email: string;
  role: UserRole;
  doctorId?: { toString(): string } | null;
  isActive: boolean;
};

export function toPublicUser(user: UserLike): PublicUser {
  const id = user.id ?? user._id?.toString();

  if (!id) {
    throw new Error("Invalid user");
  }

  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
    doctorId: user.doctorId ? user.doctorId.toString() : null,
    isActive: user.isActive,
  };
}
