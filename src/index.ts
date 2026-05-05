#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { initDb, listHospitals, listDoctors, registerPatient, listPatients, createAppointment, listAppointments, cancelAppointment } from "./db.js";

const db = initDb();

function registerTools(server: McpServer) {
  server.tool(
    "list_hospitals",
    "List available hospitals, optionally sorted by distance from your coordinates",
    {
      name: z.string().optional().describe("Search by hospital name"),
      lat: z.number().optional().describe("Your latitude (for distance sorting)"),
      lng: z.number().optional().describe("Your longitude (for distance sorting)"),
    },
    async ({ name, lat, lng }) => {
      const hospitals = listHospitals(db, { name, lat, lng });
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
    "register_patient",
    "Register a new patient in the system",
    {
      name: z.string().describe("Full name of the patient"),
      email: z.string().email().optional().describe("Patient email address"),
      phone: z.string().optional().describe("Patient phone number"),
    },
    async (params) => {
      const result = registerPatient(db, params);
      if (!result.ok) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }] };
      }
      const p = result.patient;
      return {
        content: [{
          type: "text",
          text: `Patient registered.\n  ID: ${p.id}\n  Name: ${p.name}\n  Email: ${p.email}\n  Phone: ${p.phone}`,
        }],
      };
    }
  );

  server.tool(
    "list_patients",
    "Search or list registered patients",
    {
      search: z.string().optional().describe("Search by name or email"),
    },
    async ({ search }) => {
      const patients = listPatients(db, search);
      if (patients.length === 0) {
        return { content: [{ type: "text", text: "No patients found." }] };
      }
      const lines = patients.map(
        (p) => `• ${p.name}\n  Email: ${p.email} | Phone: ${p.phone}\n  ID: ${p.id}`
      );
      return { content: [{ type: "text", text: `${patients.length} patient(s):\n\n${lines.join("\n\n")}` }] };
    }
  );

  server.tool(
    "list_doctors",
    "List doctors, optionally filtered by hospital and/or specialty",
    {
      hospital_id: z.string().optional().describe("Filter by hospital ID"),
      specialty: z.string().optional().describe("Filter by specialty (e.g. Cardiología, Pediatría)"),
      name: z.string().optional().describe("Search by doctor name"),
    },
    async (filters) => {
      const doctors = listDoctors(db, filters);
      if (doctors.length === 0) {
        return { content: [{ type: "text", text: "No doctors found." }] };
      }
      const lines = doctors.map(
        (d) => `• ${d.name}\n  Specialty: ${d.specialty} | Hospital: ${d.hospital_name}\n  ID: ${d.id}`
      );
      return { content: [{ type: "text", text: `${doctors.length} doctor(s):\n\n${lines.join("\n\n")}` }] };
    }
  );

  server.tool(
    "create_appointment",
    "Schedule a new appointment at a hospital for a registered patient",
    {
      hospital_id: z.string().describe("Hospital ID (from list_hospitals)"),
      patient_id: z.string().describe("Patient ID (from list_patients or register_patient)"),
      doctor_id: z.string().describe("Doctor ID (from list_doctors)"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Appointment date (YYYY-MM-DD)"),
      time: z.string().regex(/^\d{2}:\d{2}$/).describe("Appointment time (HH:MM, 24-hour)"),
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
          text: `Appointment scheduled.\n  ID: ${a.id}\n  Patient ID: ${a.patient_id}\n  Doctor ID: ${a.doctor_id}\n  Date: ${a.date} at ${a.time}`,
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
      doctor_id: z.string().optional().describe("Filter by doctor ID"),
      patient_id: z.string().optional().describe("Filter by patient ID"),
      status: z.enum(["scheduled", "cancelled"]).optional().describe("Filter by status (default: scheduled)"),
    },
    async (filters) => {
      const rows = listAppointments(db, filters);
      if (rows.length === 0) {
        return { content: [{ type: "text", text: "No appointments found." }] };
      }
      const lines = rows.map(
        (a) =>
          `• ${a.date} ${a.time} — ${a.patient_name} with ${a.doctor_name}\n  Specialty: ${a.specialty} | Hospital: ${a.hospital_name}\n  ID: ${a.id} | Status: ${a.status}`
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
          text: `Appointment cancelled.\n  Patient: ${a.patient_name}\n  Doctor: ${a.doctor_name}\n  Was scheduled: ${a.date} at ${a.time}\n  Hospital: ${a.hospital_name}`,
        }],
      };
    }
  );
}

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "turnos", version: "1.0.0" });
  registerTools(server);
  return server;
}

async function main() {
  const useHttp = process.argv.includes("--http");
  const port = parseInt(process.env.PORT || "3001", 10);

  if (useHttp) {
    const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }

      if (url.pathname !== "/mcp") {
        res.writeHead(404).end("Not found");
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId)!.transport.handleRequest(req, res);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      const server = createMcpServer();

      await server.connect(transport);

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await transport.handleRequest(req, res);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, { server, transport });
      }
    });

    httpServer.listen(port, () => {
      console.error(`Turnos MCP Server running on http://localhost:${port}/mcp`);
    });
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Turnos MCP Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
