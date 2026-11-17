import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    passWithNoTests: true,
    hookTimeout: 180_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      PORT: "5000",
      MONGODB_URI: "mongodb://127.0.0.1:27017/doctor-tracker-test",
      CORS_ORIGIN: "http://localhost:3000",
      ACCESS_TOKEN_SECRET: "test-access-token-secret-32chars-min",
      REFRESH_TOKEN_SECRET: "test-refresh-token-secret-32chars-min",
      ACCESS_TOKEN_TTL: "15m",
      REFRESH_TOKEN_TTL: "7d",
      ADMIN_NAME: "Admin",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "admin-password",
    },
  },
});
