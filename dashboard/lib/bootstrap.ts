import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { Role } from './auth';

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;

export async function bootstrapSuperadmin() {
  if (!SUPERADMIN_EMAIL) return;

  const user = await currentUser();
  if (!user) return;

  // Check if current user matches SUPERADMIN_EMAIL
  const emailMatches = user.emailAddresses.some(
    (email) => email.emailAddress === SUPERADMIN_EMAIL
  );

  if (!emailMatches) return;

  const currentRole = user.publicMetadata.role as Role | undefined;
  const isAllowlisted = user.publicMetadata.allowlisted === true;

  // If already fully configured, do nothing
  if (currentRole === 'superadmin' && isAllowlisted) return;

  const client = await clerkClient();

  // If already superadmin but not allowlisted, just set allowlisted
  if (currentRole === 'superadmin') {
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        allowlisted: true,
      },
    });
    console.log(`Updated superadmin allowlist: ${SUPERADMIN_EMAIL}`);
    return;
  }

  // If match and not superadmin, assign superadmin + allowlisted
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: {
      ...user.publicMetadata,
      role: 'superadmin' satisfies Role,
      allowlisted: true,
    },
  });

  console.log(`Bootstrapped superadmin: ${SUPERADMIN_EMAIL}`);
}
