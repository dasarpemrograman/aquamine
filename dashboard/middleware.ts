import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/not-authorized(.*)",
]);

const isNotAuthorizedRoute = createRouteMatcher(["/not-authorized(.*)"]);

const isAllowlistedEmail = async (
  client: Awaited<ReturnType<typeof clerkClient>>,
  email: string,
) => {
  const allowlist =
    await client.allowlistIdentifiers.getAllowlistIdentifierList();
  const normalizedEmail = email.toLowerCase();

  return allowlist.data.some(
    (entry) =>
      entry.identifierType === "email_address" &&
      entry.identifier.toLowerCase() === normalizedEmail,
  );
};

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const { userId } = await auth();

  if (!userId || isNotAuthorizedRoute(req)) {
    return;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (!primaryEmail) {
    return NextResponse.redirect(new URL("/not-authorized", req.url));
  }

  const allowlisted = await isAllowlistedEmail(client, primaryEmail);

  if (!allowlisted) {
    return NextResponse.redirect(new URL("/not-authorized", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!api|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
