import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/login(.*)",
  "/not-authorized(.*)",
]);

const isAccessPendingRoute = createRouteMatcher(["/access-pending(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  if (userId && req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  if (!userId) {
    return;
  }

  const allowlisted = sessionClaims?.metadata?.allowlisted === true;

  if (!allowlisted && !isAccessPendingRoute(req)) {
    return NextResponse.redirect(new URL("/access-pending", req.url));
  }

  if (allowlisted && isAccessPendingRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!api|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
