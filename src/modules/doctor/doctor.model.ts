import { Schema, model, type HydratedDocument } from "mongoose";

export interface IDoctor {
  name: string;
  phone: string;
  specialization: string | null;
  hospital: string | null;
}

export type DoctorDocument = HydratedDocument<IDoctor>;

const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    specialization: { type: String, trim: true, default: null },
    hospital: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

doctorSchema.index({ specialization: 1 });
doctorSchema.index({ hospital: 1 });
doctorSchema.index({ createdAt: -1 });
doctorSchema.index({ createdAt: -1, _id: -1 });

export const Doctor = model<IDoctor>("Doctor", doctorSchema);
