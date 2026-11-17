import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface IRefreshSession {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: Types.ObjectId | null;
}

export type RefreshSessionDocument = HydratedDocument<IRefreshSession>;

const refreshSessionSchema = new Schema<IRefreshSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBySessionId: {
      type: Schema.Types.ObjectId,
      ref: "RefreshSession",
      default: null,
    },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ userId: 1 });
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession = model<IRefreshSession>(
  "RefreshSession",
  refreshSessionSchema,
);
