import { pathToFileURL } from "node:url";

import { connectDb, disconnectDb } from "../config/db.js";
import { createDoctorAccount } from "../modules/doctor/doctor.service.js";
import { Patient } from "../modules/patient/patient.model.js";
import { toDateOnly } from "../modules/patient/patient.service.js";
import { User } from "../modules/user/user.model.js";
import { logger } from "../utils/logger.js";
import { seedAdmin } from "./seedAdmin.js";

const MOCK_DOCTOR_EMAIL = "seed.dr.amelia@doctor-tracker.mock";
const MOCK_DOCTOR_PASSWORD = "Doctor123!";

const mockDoctors = [
  {
    name: "Dr. Amelia Rivers",
    phone: "+1 (555) 201-4401",
    email: "seed.dr.amelia@doctor-tracker.mock",
    password: MOCK_DOCTOR_PASSWORD,
    specialization: "Cardiology",
    hospital: "Metro Heart Institute",
  },
  {
    name: "Dr. James Okonkwo",
    phone: "+1 (555) 201-4402",
    email: "seed.dr.james@doctor-tracker.mock",
    password: MOCK_DOCTOR_PASSWORD,
    specialization: "Pediatrics",
    hospital: "Sunrise Children's Hospital",
  },
  {
    name: "Dr. Priya Sharma",
    phone: "+1 (555) 201-4403",
    email: "seed.dr.priya@doctor-tracker.mock",
    password: MOCK_DOCTOR_PASSWORD,
    specialization: "Orthopedics",
    hospital: "Northside Medical Center",
  },
] as const;

const mockPatientsByDoctorEmail: Record<
  string,
  Array<{ name: string; condition: string; date: string }>
> = {
  "seed.dr.amelia@doctor-tracker.mock": [
    { name: "Robert Klein", condition: "Hypertension", date: "2025-11-02" },
    { name: "Maria Santos", condition: "Arrhythmia follow-up", date: "2025-11-10" },
    { name: "Ethan Moore", condition: "Post-angioplasty check", date: "2025-11-15" },
  ],
  "seed.dr.james@doctor-tracker.mock": [
    { name: "Lily Chen", condition: "Seasonal asthma", date: "2025-10-28" },
    { name: "Noah Patel", condition: "Vaccination review", date: "2025-11-05" },
  ],
  "seed.dr.priya@doctor-tracker.mock": [
    { name: "Hannah Brooks", condition: "ACL rehabilitation", date: "2025-11-01" },
    { name: "Omar Haddad", condition: "Rotator cuff strain", date: "2025-11-12" },
    { name: "Sofia Alvarez", condition: "Knee pain assessment", date: "2025-11-17" },
  ],
};

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
}

export async function seedMockData(): Promise<void> {
  await seedAdmin();

  await connectDb();

  try {
    const existingMock = await User.findOne({ email: MOCK_DOCTOR_EMAIL });

    if (existingMock) {
      logger.info("Mock doctors and patients already seeded");
      return;
    }

    for (const doctorInput of mockDoctors) {
      const { doctor } = await createDoctorAccount({
        name: doctorInput.name,
        phone: doctorInput.phone,
        email: doctorInput.email,
        password: doctorInput.password,
        specialization: doctorInput.specialization,
        hospital: doctorInput.hospital,
      });

      const patients = mockPatientsByDoctorEmail[doctorInput.email] ?? [];

      for (const patient of patients) {
        await Patient.create({
          name: patient.name,
          doctorId: doctor.id,
          condition: patient.condition,
          date: toDateOnly(patient.date),
        });
      }

      logger.info(
        { email: doctorInput.email, patients: patients.length },
        "Seeded doctor and patients",
      );
    }

    logger.info(
      {
        doctors: mockDoctors.length,
        doctorLoginPassword: MOCK_DOCTOR_PASSWORD,
      },
      "Mock data seed complete",
    );
  } finally {
    await disconnectDb();
  }
}

if (isExecutedDirectly()) {
  seedMockData().catch((error: unknown) => {
    logger.error({ err: error }, "Failed to seed mock data");
    process.exit(1);
  });
}