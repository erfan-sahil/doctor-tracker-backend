import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type UserRole = "admin" | "doctor";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  doctorId: Types.ObjectId | null;
  isActive: boolean;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ["admin", "doctor"] },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", default: null },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

userSchema.index({ doctorId: 1 });
userSchema.index({ role: 1, email: 1 });

userSchema.pre("validate", function () {
  if (this.role === "doctor" && !this.doctorId) {
    this.invalidate("doctorId", "doctorId is required for doctors");
  }

  if (this.role === "admin" && this.doctorId) {
    this.invalidate("doctorId", "admin accounts cannot have a doctorId");
  }
});

export const User = model<IUser>("User", userSchema);
