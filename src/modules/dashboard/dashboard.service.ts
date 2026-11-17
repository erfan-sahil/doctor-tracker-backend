import { Types, type PipelineStage } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import type { AuthUser } from "../../types/auth.js";
import { Doctor } from "../doctor/doctor.model.js";
import { toDateOnly } from "../patient/patient.service.js";
import { Patient } from "../patient/patient.model.js";
import type { DashboardQuery } from "./dashboard.schema.js";

export type DashboardDoctorStat = {
  doctorId: string;
  name: string;
  specialization: string | null;
  hospital: string | null;
  patientCount: number;
};

export type DashboardDateStat = {
  date: string;
  count: number;
};

export type DashboardConditionStat = {
  condition: string | null;
  count: number;
};

export type DashboardResponse = {
  totalDoctors: number;
  totalPatients: number;
  patientsPerDoctor: DashboardDoctorStat[];
  patientsByDate: DashboardDateStat[];
  patientsByCondition: DashboardConditionStat[];
};

type DateBounds = {
  from?: Date;
  toExclusive?: Date;
};

type PatientFacet = {
  total: { count: number }[];
  byDate: { _id: string; count: number }[];
  byCondition: { _id: string | null; count: number }[];
};

function requireActorDoctorId(actor: AuthUser): string {
  if (actor.role !== "doctor" || !actor.doctorId) {
    throw new ApiError(403, "Forbidden");
  }

  return actor.doctorId;
}

function dateBounds(query: DashboardQuery): DateBounds {
  const bounds: DateBounds = {};

  if (query.from) {
    bounds.from = toDateOnly(query.from);
  }

  if (query.to) {
    const end = toDateOnly(query.to);
    end.setUTCDate(end.getUTCDate() + 1);
    bounds.toExclusive = end;
  }

  return bounds;
}

function patientMatch(actor: AuthUser, bounds: DateBounds): PipelineStage.Match {
  const match: Record<string, unknown> = {};

  if (actor.role === "doctor") {
    match.doctorId = new Types.ObjectId(requireActorDoctorId(actor));
  }

  if (bounds.from || bounds.toExclusive) {
    const date: Record<string, Date> = {};

    if (bounds.from) {
      date.$gte = bounds.from;
    }

    if (bounds.toExclusive) {
      date.$lt = bounds.toExclusive;
    }

    match.date = date;
  }

  return { $match: match };
}

function lookupMatch(bounds: DateBounds): PipelineStage.Match {
  const conditions: Record<string, unknown>[] = [{ $eq: ["$doctorId", "$$doctorId"] }];

  if (bounds.from) {
    conditions.push({ $gte: ["$date", bounds.from] });
  }

  if (bounds.toExclusive) {
    conditions.push({ $lt: ["$date", bounds.toExclusive] });
  }

  return {
    $match: {
      $expr: conditions.length === 1 ? conditions[0] : { $and: conditions },
    },
  };
}

function dateFormat(groupBy: DashboardQuery["groupBy"]): string {
  return groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";
}

async function patientStatistics(
  actor: AuthUser,
  query: DashboardQuery,
  bounds: DateBounds,
): Promise<
  Pick<DashboardResponse, "totalPatients" | "patientsByDate" | "patientsByCondition">
> {
  const [facet] = await Patient.aggregate<PatientFacet>([
    patientMatch(actor, bounds),
    {
      $facet: {
        total: [{ $count: "count" }],
        byDate: [
          { $match: { date: { $ne: null } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormat(query.groupBy),
                  date: "$date",
                  timezone: "UTC",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byCondition: [
          {
            $group: {
              _id: { $ifNull: ["$condition", null] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1, _id: 1 } },
        ],
      },
    },
  ]);

  return {
    totalPatients: facet?.total[0]?.count ?? 0,
    patientsByDate: (facet?.byDate ?? []).map((row) => ({
      date: row._id,
      count: row.count,
    })),
    patientsByCondition: (facet?.byCondition ?? []).map((row) => ({
      condition: row._id,
      count: row.count,
    })),
  };
}

async function patientsPerDoctor(
  actor: AuthUser,
  bounds: DateBounds,
): Promise<DashboardDoctorStat[]> {
  const doctorId = actor.role === "doctor" ? requireActorDoctorId(actor) : undefined;
  const pipeline: PipelineStage[] = [];

  if (doctorId) {
    pipeline.push({ $match: { _id: new Types.ObjectId(doctorId) } });
  }

  pipeline.push(
    {
      $lookup: {
        from: Patient.collection.name,
        let: { doctorId: "$_id" },
        pipeline: [lookupMatch(bounds), { $count: "count" }],
        as: "stats",
      },
    },
    {
      $project: {
        _id: 0,
        doctorId: { $toString: "$_id" },
        name: 1,
        specialization: { $ifNull: ["$specialization", null] },
        hospital: { $ifNull: ["$hospital", null] },
        patientCount: {
          $ifNull: [{ $arrayElemAt: ["$stats.count", 0] }, 0],
        },
      },
    },
    { $sort: { patientCount: -1, name: 1 } },
  );

  return Doctor.aggregate<DashboardDoctorStat>(pipeline);
}

export async function getDashboard(
  actor: AuthUser,
  query: DashboardQuery,
): Promise<DashboardResponse> {
  const bounds = dateBounds(query);
  const [patientStats, doctors] = await Promise.all([
    patientStatistics(actor, query, bounds),
    patientsPerDoctor(actor, bounds),
  ]);

  return {
    totalDoctors: doctors.length,
    ...patientStats,
    patientsPerDoctor: doctors,
  };
}
