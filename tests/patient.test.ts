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
  payload: { name: string; email: string },
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

describe("patient management", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/patients");
    expect(response.status).toBe(401);
  });

  it("lets an admin create, search, filter, update, and delete patients", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);
    const ada = await createDoctor(adminToken, {
      name: "Dr Ada",
      email: "ada@example.com",
    });
    const grace = await createDoctor(adminToken, {
      name: "Dr Grace",
      email: "grace@example.com",
    });

    const missingDoctor = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "No Doctor" });
    expect(missingDoctor.status).toBe(400);

    const unknownDoctor = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Unknown",
        doctorId: "507f1f77bcf86cd799439011",
      });
    expect(unknownDoctor.status).toBe(404);

    const created = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Mina Alvarez",
        doctorId: ada.id,
        condition: "Asthma",
        date: "2026-03-01",
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: "Mina Alvarez",
      doctorId: ada.id,
      condition: "Asthma",
      date: "2026-03-01",
    });

    const patientId = created.body.data.id as string;

    await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Mina Brooks",
        doctorId: ada.id,
        condition: "Migraine",
        date: "2026-03-02",
      });

    await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Owen Blake",
        doctorId: grace.id,
        condition: "Asthma",
        date: "2026-04-01",
      });

    const page = await request(app)
      .get("/api/v1/patients")
      .query({ page: 1, limit: 2 })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(page.status).toBe(200);
    expect(page.body.data.patients).toHaveLength(2);
    expect(page.body.data).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const search = await request(app)
      .get("/api/v1/patients")
      .query({ search: "mina" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(search.status).toBe(200);
    expect(search.body.data.total).toBe(2);
    expect(
      search.body.data.patients.every((patient: { name: string }) =>
        patient.name.toLowerCase().includes("mina"),
      ),
    ).toBe(true);

    const byDoctor = await request(app)
      .get("/api/v1/patients")
      .query({ doctorId: grace.id })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byDoctor.body.data.patients).toHaveLength(1);
    expect(byDoctor.body.data.patients[0].name).toBe("Owen Blake");

    const byCondition = await request(app)
      .get("/api/v1/patients")
      .query({ condition: "asthma" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byCondition.body.data.total).toBe(2);

    const byDate = await request(app)
      .get("/api/v1/patients")
      .query({ date: "2026-03-01" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byDate.body.data.patients).toHaveLength(1);
    expect(byDate.body.data.patients[0].id).toBe(patientId);

    const details = await request(app)
      .get(`/api/v1/patients/${patientId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(details.status).toBe(200);
    expect(details.body.data.condition).toBe("Asthma");

    const updated = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Mina Alvarez Renamed",
        condition: null,
        doctorId: grace.id,
        date: "2026-05-10",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: "Mina Alvarez Renamed",
      condition: null,
      doctorId: grace.id,
      date: "2026-05-10",
    });

    const doctorPatients = await request(app)
      .get(`/api/v1/doctors/${grace.id}/patients`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(doctorPatients.status).toBe(200);
    expect(doctorPatients.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: patientId,
          condition: null,
          date: "2026-05-10",
          doctorId: grace.id,
        }),
      ]),
    );

    const removed = await request(app)
      .delete(`/api/v1/patients/${patientId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(removed.status).toBe(200);

    const missing = await request(app)
      .get(`/api/v1/patients/${patientId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });

  it("limits a doctor to patients they own", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);
    const ada = await createDoctor(adminToken, {
      name: "Dr Ada",
      email: "ada@example.com",
    });
    const grace = await createDoctor(adminToken, {
      name: "Dr Grace",
      email: "grace@example.com",
    });

    const own = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ name: "Ada Patient", condition: "Flu", date: "2026-01-15" });

    expect(own.status).toBe(201);
    expect(own.body.data.doctorId).toBe(ada.id);

    const explicitOwn = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ name: "Ada Explicit", doctorId: ada.id });
    expect(explicitOwn.status).toBe(201);
    expect(explicitOwn.body.data).toMatchObject({
      doctorId: ada.id,
      condition: null,
      date: null,
    });

    const otherAssign = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ name: "Wrong Doctor", doctorId: grace.id });
    expect(otherAssign.status).toBe(403);

    const gracePatient = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Grace Patient", doctorId: grace.id, condition: "Flu" });
    expect(gracePatient.status).toBe(201);
    const gracePatientId = gracePatient.body.data.id as string;

    const list = await request(app)
      .get("/api/v1/patients")
      .set("Authorization", `Bearer ${ada.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(2);
    expect(
      list.body.data.patients.every(
        (patient: { doctorId: string }) => patient.doctorId === ada.id,
      ),
    ).toBe(true);

    const filtered = await request(app)
      .get("/api/v1/patients")
      .query({ condition: "flu", date: "2026-01-15" })
      .set("Authorization", `Bearer ${ada.token}`);
    expect(filtered.body.data.patients).toHaveLength(1);
    expect(filtered.body.data.patients[0].name).toBe("Ada Patient");

    const otherFilter = await request(app)
      .get("/api/v1/patients")
      .query({ doctorId: grace.id })
      .set("Authorization", `Bearer ${ada.token}`);
    expect(otherFilter.status).toBe(403);

    const hiddenGet = await request(app)
      .get(`/api/v1/patients/${gracePatientId}`)
      .set("Authorization", `Bearer ${ada.token}`);
    expect(hiddenGet.status).toBe(404);

    const hiddenPatch = await request(app)
      .patch(`/api/v1/patients/${gracePatientId}`)
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ name: "Stolen" });
    expect(hiddenPatch.status).toBe(404);

    const hiddenDelete = await request(app)
      .delete(`/api/v1/patients/${gracePatientId}`)
      .set("Authorization", `Bearer ${ada.token}`);
    expect(hiddenDelete.status).toBe(404);

    const reassign = await request(app)
      .patch(`/api/v1/patients/${own.body.data.id}`)
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ doctorId: ada.id });
    expect(reassign.status).toBe(403);

    const updated = await request(app)
      .patch(`/api/v1/patients/${own.body.data.id}`)
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ condition: "Cold" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.condition).toBe("Cold");
    expect(updated.body.data.doctorId).toBe(ada.id);

    const removed = await request(app)
      .delete(`/api/v1/patients/${own.body.data.id}`)
      .set("Authorization", `Bearer ${ada.token}`);
    expect(removed.status).toBe(200);

    const stillThere = await request(app)
      .get(`/api/v1/patients/${gracePatientId}`)
      .set("Authorization", `Bearer ${grace.token}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.name).toBe("Grace Patient");
  });
});
