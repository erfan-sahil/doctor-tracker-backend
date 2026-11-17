import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request, { type Response } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { User } from "../src/modules/user/user.model.js";
import { hashPassword } from "../src/utils/password.js";

const app = createApp();
const adminPassword = "admin-password";

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

function setCookieHeader(response: Response): string {
  const header = response.headers["set-cookie"];

  if (Array.isArray(header)) {
    return header.join(" ");
  }

  return header ?? "";
}

function cookiePair(response: Response): string {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const pair = cookies
    .map((entry) => entry.split(";")[0])
    .filter((entry): entry is string => Boolean(entry))
    .join("; ");

  if (!pair) {
    throw new Error("Expected a refresh cookie");
  }

  return pair;
}

async function createAdmin(): Promise<void> {
  await User.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash: await hashPassword(adminPassword),
    role: "admin",
    isActive: true,
  });
}

async function login(email: string, password: string): Promise<Response> {
  return request(app).post("/api/v1/auth/login").send({ email, password });
}

async function accessTokenFor(email: string, password: string): Promise<string> {
  const response = await login(email, password);
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

describe("authentication", () => {
  it("logs in with a refresh cookie and rejects bad credentials", async () => {
    await createAdmin();

    const success = await login("admin@example.com", adminPassword);

    expect(success.status).toBe(200);
    expect(success.body.data.user).toMatchObject({
      email: "admin@example.com",
      role: "admin",
      doctorId: null,
      isActive: true,
    });
    expect(success.body.data.user).not.toHaveProperty("passwordHash");
    expect(success.body.data).not.toHaveProperty("refreshToken");
    expect(setCookieHeader(success)).toMatch(/HttpOnly/i);
    expect(setCookieHeader(success)).toContain("Path=/api/v1/auth");

    const invalid = await login("admin@example.com", "wrong-password");
    expect(invalid.status).toBe(401);
    expect(invalid.body.message).toBe("Invalid email or password");

    const unknown = await login("missing@example.com", adminPassword);
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe("Invalid email or password");
  });

  it("rejects inactive accounts", async () => {
    await User.create({
      name: "Inactive",
      email: "inactive@example.com",
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
      isActive: false,
    });

    const response = await login("inactive@example.com", adminPassword);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Account is inactive");
  });

  it("returns the current user and rejects missing, invalid, or expired access tokens", async () => {
    await createAdmin();
    const token = await accessTokenFor("admin@example.com", adminPassword);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("admin@example.com");

    const missing = await request(app).get("/api/v1/auth/me");
    expect(missing.status).toBe(401);
    expect(missing.body.message).toBe("Authentication required");

    const invalid = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-token");
    expect(invalid.status).toBe(401);
    expect(invalid.body.message).toBe("Invalid or expired access token");

    const expired = jwt.sign(
      {
        sub: me.body.data.id as string,
        type: "access",
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      env.ACCESS_TOKEN_SECRET,
      { algorithm: "HS256" },
    );
    const expiredResponse = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expired}`);

    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.message).toBe("Invalid or expired access token");

    await User.updateOne({ email: "admin@example.com" }, { isActive: false });
    const inactive = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(inactive.status).toBe(401);
  });

  it("rotates refresh tokens and revokes the session family on reuse", async () => {
    await createAdmin();
    const first = await login("admin@example.com", adminPassword);
    const firstCookie = cookiePair(first);

    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", firstCookie);
    const secondCookie = cookiePair(rotated);

    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));
    expect(secondCookie).not.toBe(firstCookie);

    const reused = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", firstCookie);

    expect(reused.status).toBe(401);
    expect(reused.body.message).toBe("Invalid or expired refresh token");

    const familyRevoked = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", secondCookie);

    expect(familyRevoked.status).toBe(401);
  });

  it("revokes the refresh session on logout", async () => {
    await createAdmin();
    const loggedIn = await login("admin@example.com", adminPassword);
    const cookie = cookiePair(loggedIn);

    const loggedOut = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);

    expect(loggedOut.status).toBe(200);
    expect(setCookieHeader(loggedOut)).toContain("refreshToken=");

    const refresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(refresh.status).toBe(401);

    const missingCookie = await request(app).post("/api/v1/auth/logout");
    expect(missingCookie.status).toBe(200);
  });
});
