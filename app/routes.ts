import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("hospitales", "routes/hospitales.tsx"),
  route("doctores", "routes/doctores.tsx"),
  route("pacientes", "routes/pacientes.tsx"),
  route("turnos", "routes/turnos.tsx"),
] satisfies RouteConfig;
