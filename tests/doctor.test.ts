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

describe("doctor list queries", () => {
  it("matches doctors by login email even when the doctor profile name does not match", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);

    const created = await request(app)
      .post("/api/v1/doctors")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Dr Profile Name",
        phone: defaultDoctorPhone,
        email: "unique.clinic@example.com",
        password: doctorPassword,
      });

    expect(created.status).toBe(201);

    const search = await request(app)
      .get("/api/v1/doctors")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ search: "unique.clinic" });

    expect(search.status).toBe(200);
    expect(search.body.data.total).toBe(1);
    expect(search.body.data.doctors[0].user.email).toBe("unique.clinic@example.com");
  });

  it("rejects an invalid created date range", async () => {
    await createAdmin();
    const adminToken = await accessTokenFor("admin@example.com", adminPassword);

    const response = await request(app)
      .get("/api/v1/doctors")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ createdFrom: "2099-12-31", createdTo: "2099-01-01" });

    expect(response.status).toBe(400);
  });
});