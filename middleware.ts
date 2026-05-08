/**
 * HTTP Basic Auth gate for `/admin/*`. Runs on the Edge runtime so the
 * unauthenticated branch returns 401 before any server-component work.
 *
 * Credentials are read from `ADMIN_USER` / `ADMIN_PASS` server-side
 * (per plan.md section 9.5 security paragraph). Comparison uses a
 * constant-time-ish XOR over the credential bytes; a length-mismatch
 * leak is acceptable for a take-home demo and avoids importing
 * Node-only `crypto.timingSafeEqual` into the Edge runtime.
 *
 * The `/admin/*` matcher is the only thing this middleware touches.
 * Public pages (`/`, `/article/...`, `/sync-status`, etc.) are NOT
 * affected.
 */
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

const REALM = "TRD Lite Admin";
const WWW_AUTHENTICATE_VALUE = `Basic realm="${REALM}", charset="UTF-8"`;

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": WWW_AUTHENTICATE_VALUE,
      "Cache-Control": "no-store",
    },
  });
}

function decodeBasic(header: string): { user: string; pass: string } | null {
  if (!header.startsWith("Basic ")) return null;
  const encoded = header.slice("Basic ".length).trim();
  if (encoded.length === 0) return null;
  let decoded: string;
  try {
    // `atob` exists natively in the Edge runtime and avoids pulling in
    // Node's `Buffer` polyfill.
    decoded = atob(encoded);
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep === -1) {
    return { user: decoded, pass: "" };
  }
  return { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) };
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  // Length leak is acceptable here for a take-home demo. The win is
  // avoiding a Node-only crypto import on the Edge runtime.
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER ?? "";
  const expectedPass = process.env.ADMIN_PASS ?? "";
  if (!expectedUser || !expectedPass) {
    // Fail closed if the deployment is mis-configured: we will never
    // accept credentials when there is nothing to compare against.
    return new NextResponse("Server misconfigured", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  const decoded = decodeBasic(auth);
  if (!decoded) {
    return unauthorized();
  }

  const userOk = timingSafeEqualStrings(decoded.user, expectedUser);
  const passOk = timingSafeEqualStrings(decoded.pass, expectedPass);
  if (!userOk || !passOk) {
    return unauthorized();
  }

  return NextResponse.next();
}
