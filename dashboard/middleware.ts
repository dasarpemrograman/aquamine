import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/login(.*)",
  "/not-authorized(.*)",
]);

const isAccessPendingRoute = createRouteMatcher(["/access-pending(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const client = userId ? await clerkClient() : null;
  const user = userId ? await client!.users.getUser(userId) : null;
  const allowlisted = user?.publicMetadata.allowlisted === true;
  const superadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const primaryEmail = user?.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress?.toLowerCase();

  if (userId && req.nextUrl.pathname.startsWith('/login')) {
    const destination = allowlisted ? "/" : "/access-pending";
    return NextResponse.redirect(new URL(destination, req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  if (!userId) {
    return;
  }

  if (!allowlisted && superadminEmail && primaryEmail === superadminEmail) {
    try {
      const limit = 100;
      let offset = 0;
      let superadminExists = false;

      while (true) {
        const response = await client!.users.getUserList({ limit, offset });
        const users = Array.isArray(response) ? response : response.data;

        if (users.some((entry) => entry.publicMetadata.role === "superadmin")) {
          superadminExists = true;
          break;
        }

        if (Array.isArray(response) || users.length < limit) {
          break;
        }

        offset += limit;
      }

      if (!superadminExists) {
        await client!.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...user!.publicMetadata,
            role: "superadmin",
            allowlisted: true,
          },
        });

        return NextResponse.redirect(new URL("/", req.url));
      }
    } catch (error) {
      console.error("Superadmin bootstrap failed:", error);
    }
  }

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
