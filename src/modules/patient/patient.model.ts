import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface IPatient {
  name: string;
  doctorId: Types.ObjectId;
}

export type PatientDocument = HydratedDocument<IPatient>;

const patientSchema = new Schema<IPatient>(
  {
    name: { type: String, required: true, trim: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
  },
  { timestamps: true },
);

patientSchema.index({ doctorId: 1 });

export const Patient = model<IPatient>("Patient", patientSchema);
