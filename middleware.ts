import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the admin section is gated. Public pages, the Vapi/agent-ui webhooks
// and the MCP endpoint stay open (the latter two are excluded from the matcher
// below so Clerk never touches their CORS / session handling).
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|api|mcp|.*\\..*).*)"],
};
