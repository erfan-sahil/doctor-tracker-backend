import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { User } from "../src/modules/user/user.model.js";
import { hashPassword } from "../src/utils/password.js";

const app = createApp();
const adminPassword = "admin-password";
const doctorPassword = "doctor-password";
const defaultDoctorPhone = "+1-555-0100";

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

async function createAdmin(): Promise<void> {
  await User.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash: await hashPassword(adminPassword),
    role: "admin",
    isActive: true,
  });
}

async function accessTokenFor(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

async function createDoctor(
  adminToken: string,
  payload: { name: string; email: string; specialization?: string; hospital?: string },
): Promise<{ id: string; token: string }> {
  const created = await request(app)
    .post("/api/v1/doctors")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      phone: defaultDoctorPhone,
      ...payload,
      password: doctorPassword,
    });

  expect(created.status).toBe(201);

  return {
    id: created.body.data.doctor.id as string,
    token: await accessTokenFor(payload.email, doctorPassword),
  };
}

async function createPatient(
  token: string,
  payload: {
    name: string;
    doctorId?: string;
    condition?: string | null;
    date?: string | null;
  },
): Promise<void> {
  const created = await request(app)
    .post("/api/v1/patients")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

  expect(created.status).toBe(201);
}

describe("dashboard analytics", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/dashboard");
    expect(response.status).toBe(401);
  });

  it("returns practice-wide totals, including doctors with no patients", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);
    const ada = await createDoctor(adminToken, {
      name: "Dr Ada",
      email: "ada@example.com",
      specialization: "Cardiology",
      hospital: "City Hospital",
    });
    const grace = await createDoctor(adminToken, {
      name: "Dr Grace",
      email: "grace@example.com",
    });
    const owen = await createDoctor(adminToken, {
      name: "Dr Owen",
      email: "owen@example.com",
      specialization: "Neurology",
    });

    await createPatient(adminToken, {
      name: "Mina Alvarez",
      doctorId: ada.id,
      condition: "Asthma",
      date: "2026-03-01",
    });
    await createPatient(adminToken, {
      name: "Leo Null",
      doctorId: ada.id,
      condition: null,
      date: null,
    });
    await createPatient(adminToken, {
      name: "Sam Blake",
      doctorId: owen.id,
      condition: "Asthma",
      date: "2026-04-15",
    });

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Dashboard retrieved",
    });
    expect(response.body.data).toEqual({
      totalDoctors: 3,
      totalPatients: 3,
      patientsPerDoctor: [
        {
          doctorId: ada.id,
          name: "Dr Ada",
          specialization: "Cardiology",
          hospital: "City Hospital",
          patientCount: 2,
        },
        {
          doctorId: owen.id,
          name: "Dr Owen",
          specialization: "Neurology",
          hospital: null,
          patientCount: 1,
        },
        {
          doctorId: grace.id,
          name: "Dr Grace",
          specialization: null,
          hospital: null,
          patientCount: 0,
        },
      ],
      patientsByDate: [
        { date: "2026-03-01", count: 1 },
        { date: "2026-04-15", count: 1 },
      ],
      patientsByCondition: [
        { condition: "Asthma", count: 2 },
        { condition: null, count: 1 },
      ],
    });
  });

  it("limits a doctor to their own patients", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);
    const ada = await createDoctor(adminToken, {
      name: "Dr Ada",
      email: "ada@example.com",
      specialization: "Cardiology",
      hospital: "City Hospital",
    });
    const grace = await createDoctor(adminToken, {
      name: "Dr Grace",
      email: "grace@example.com",
    });
    const idle = await createDoctor(adminToken, {
      name: "Dr Idle",
      email: "idle@example.com",
    });

    await createPatient(adminToken, {
      name: "Ada Patient",
      doctorId: ada.id,
      condition: "Flu",
      date: "2026-01-15",
    });
    await createPatient(adminToken, {
      name: "Ada Undated",
      doctorId: ada.id,
    });
    await createPatient(adminToken, {
      name: "Grace Patient",
      doctorId: grace.id,
      condition: "Flu",
      date: "2026-02-01",
    });

    const own = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${ada.token}`);

    expect(own.status).toBe(200);
    expect(own.body.data).toEqual({
      totalDoctors: 1,
      totalPatients: 2,
      patientsPerDoctor: [
        {
          doctorId: ada.id,
          name: "Dr Ada",
          specialization: "Cardiology",
          hospital: "City Hospital",
          patientCount: 2,
        },
      ],
      patientsByDate: [{ date: "2026-01-15", count: 1 }],
      patientsByCondition: [
        { condition: null, count: 1 },
        { condition: "Flu", count: 1 },
      ],
    });

    const graceDashboard = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${grace.token}`);

    expect(graceDashboard.status).toBe(200);
    expect(graceDashboard.body.data).toEqual({
      totalDoctors: 1,
      totalPatients: 1,
      patientsPerDoctor: [
        {
          doctorId: grace.id,
          name: "Dr Grace",
          specialization: null,
          hospital: null,
          patientCount: 1,
        },
      ],
      patientsByDate: [{ date: "2026-02-01", count: 1 }],
      patientsByCondition: [{ condition: "Flu", count: 1 }],
    });

    const empty = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${idle.token}`);

    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual({
      totalDoctors: 1,
      totalPatients: 0,
      patientsPerDoctor: [
        {
          doctorId: idle.id,
          name: "Dr Idle",
          specialization: null,
          hospital: null,
          patientCount: 0,
        },
      ],
      patientsByDate: [],
      patientsByCondition: [],
    });
  });

  it("filters patient statistics by date and groups by month", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);
    const ada = await createDoctor(adminToken, {
      name: "Dr Ada",
      email: "ada@example.com",
    });
    const owen = await createDoctor(adminToken, {
      name: "Dr Owen",
      email: "owen@example.com",
    });

    await createPatient(adminToken, {
      name: "March One",
      doctorId: ada.id,
      condition: "Asthma",
      date: "2026-03-01",
    });
    await createPatient(adminToken, {
      name: "March Two",
      doctorId: ada.id,
      condition: "Migraine",
      date: "2026-03-20",
    });
    await createPatient(adminToken, {
      name: "April",
      doctorId: owen.id,
      condition: "Asthma",
      date: "2026-04-15",
    });
    await createPatient(adminToken, {
      name: "Undated",
      doctorId: ada.id,
      condition: "Flu",
    });

    const ranged = await request(app)
      .get("/api/v1/dashboard")
      .query({ from: "2026-04-01", to: "2026-04-30" })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(ranged.status).toBe(200);
    expect(ranged.body.data.totalDoctors).toBe(2);
    expect(ranged.body.data.totalPatients).toBe(1);
    expect(ranged.body.data.patientsPerDoctor).toEqual([
      expect.objectContaining({ doctorId: owen.id, patientCount: 1 }),
      expect.objectContaining({ doctorId: ada.id, patientCount: 0 }),
    ]);
    expect(ranged.body.data.patientsByDate).toEqual([{ date: "2026-04-15", count: 1 }]);
    expect(ranged.body.data.patientsByCondition).toEqual([
      { condition: "Asthma", count: 1 },
    ]);

    const monthly = await request(app)
      .get("/api/v1/dashboard")
      .query({ from: "2026-03-01", to: "2026-04-30", groupBy: "month" })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(monthly.status).toBe(200);
    expect(monthly.body.data.totalDoctors).toBe(2);
    expect(monthly.body.data.totalPatients).toBe(3);
    expect(monthly.body.data.patientsByDate).toEqual([
      { date: "2026-03", count: 2 },
      { date: "2026-04", count: 1 },
    ]);
    expect(monthly.body.data.patientsByCondition).toEqual([
      { condition: "Asthma", count: 2 },
      { condition: "Migraine", count: 1 },
    ]);
  });

  it("rejects an invalid date range", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);

    const invalid = await request(app)
      .get("/api/v1/dashboard")
      .query({ from: "2026-02-31" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);

    const reversed = await request(app)
      .get("/api/v1/dashboard")
      .query({ from: "2026-05-01", to: "2026-04-01" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(reversed.status).toBe(400);
    expect(reversed.body.message).toBe("from must not be after to");
  });
});
