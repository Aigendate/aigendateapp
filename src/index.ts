#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initDb, listHospitals, createAppointment, listAppointments, cancelAppointment } from "./db.js";

const db = initDb();

const server = new McpServer({
  name: "turnos",
  version: "1.0.0",
});

server.tool(
  "list_hospitals",
  "List available hospitals, optionally sorted by distance from your coordinates",
  {
    lat: z.number().optional().describe("Your latitude (for distance sorting)"),
    lng: z.number().optional().describe("Your longitude (for distance sorting)"),
  },
  async ({ lat, lng }) => {
    const hospitals = listHospitals(db, lat, lng);
    if (hospitals.length === 0) {
      return { content: [{ type: "text", text: "No hospitals found." }] };
    }
    const lines = hospitals.map((h) => {
      let line = `• ${h.name}\n  Address: ${h.address}\n  ID: ${h.id}`;
      if (h.distance_km !== undefined) line += `\n  Distance: ${h.distance_km} km`;
      return line;
    });
    return { content: [{ type: "text", text: lines.join("\n\n") }] };
  }
);

server.tool(
  "create_appointment",
  "Schedule a new appointment at a hospital",
  {
    hospital_id: z.string().describe("Hospital ID (from list_hospitals)"),
    patient: z.string().describe("Full name of the patient"),
    doctor: z.string().describe("Full name of the doctor"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Appointment date (YYYY-MM-DD)"),
    time: z.string().regex(/^\d{2}:\d{2}$/).describe("Appointment time (HH:MM, 24-hour)"),
    specialty: z.string().describe("Medical specialty (e.g. Cardiologia, Pediatria)"),
  },
  async (params) => {
    const result = createAppointment(db, params);
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    }
    const a = result.appointment;
    return {
      content: [{
        type: "text",
        text: `Appointment scheduled.\n  ID: ${a.id}\n  Patient: ${a.patient}\n  Doctor: ${a.doctor}\n  Date: ${a.date} at ${a.time}\n  Specialty: ${a.specialty}`,
      }],
    };
  }
);

server.tool(
  "list_appointments",
  "List appointments with optional filters",
  {
    hospital_id: z.string().optional().describe("Filter by hospital ID"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Filter by date (YYYY-MM-DD)"),
    doctor: z.string().optional().describe("Filter by doctor name"),
    patient: z.string().optional().describe("Filter by patient name"),
    status: z.enum(["scheduled", "cancelled"]).optional().describe("Filter by status (default: scheduled)"),
  },
  async (filters) => {
    const rows = listAppointments(db, filters);
    if (rows.length === 0) {
      return { content: [{ type: "text", text: "No appointments found." }] };
    }
    const lines = rows.map(
      (a) =>
        `• ${a.date} ${a.time} — ${a.patient} with ${a.doctor}\n  Specialty: ${a.specialty} | Hospital: ${a.hospital_name}\n  ID: ${a.id} | Status: ${a.status}`
    );
    return { content: [{ type: "text", text: `${rows.length} appointment(s):\n\n${lines.join("\n\n")}` }] };
  }
);

server.tool(
  "cancel_appointment",
  "Cancel an existing appointment by ID",
  {
    id: z.string().describe("The appointment ID to cancel"),
  },
  async ({ id }) => {
    const result = cancelAppointment(db, id);
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    }
    const a = result.appointment;
    return {
      content: [{
        type: "text",
        text: `Appointment cancelled.\n  Patient: ${a.patient}\n  Doctor: ${a.doctor}\n  Was scheduled: ${a.date} at ${a.time}\n  Hospital: ${a.hospital_name}`,
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Turnos MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
