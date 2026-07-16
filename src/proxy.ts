import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/samples",
  "/companies",
  "/applications",
  "/insights",
  "/search",
  "/jobs",
  "/charge",
  "/admin",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/samples/:path*",
    "/companies/:path*",
    "/applications/:path*",
    "/insights/:path*",
    "/search/:path*",
    "/jobs/:path*",
    "/charge/:path*",
    "/admin/:path*",
  ],
};
