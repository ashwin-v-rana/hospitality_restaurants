import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Clears the session cookie and bounces to /login. Used when a Server Component
 * (which can't mutate cookies) detects the agent is no longer valid — e.g. a
 * deactivated agent whose JWT is still otherwise valid.
 */
export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason");
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = reason ? `reason=${encodeURIComponent(reason)}` : "";
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
