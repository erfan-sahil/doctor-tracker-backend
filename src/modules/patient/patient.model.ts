import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface IPatient {
  name: string;
  doctorId: Types.ObjectId;
  condition: string | null;
  date: Date | null;
}

export type PatientDocument = HydratedDocument<IPatient>;

const patientSchema = new Schema<IPatient>(
  {
    name: { type: String, required: true, trim: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    condition: { type: String, trim: true, default: null },
    date: { type: Date, default: null },
  },
  { timestamps: true },
);

patientSchema.index({ doctorId: 1, date: -1 });
patientSchema.index({ condition: 1, date: -1 });
patientSchema.index({ name: 1 });

export const Patient = model<IPatient>("Patient", patientSchema);
