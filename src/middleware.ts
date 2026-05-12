import { type NextRequest, NextResponse } from "next/server";

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/signin")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}
