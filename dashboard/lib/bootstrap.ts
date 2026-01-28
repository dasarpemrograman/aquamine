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

  // Check if user already has the role
  const currentRole = user.publicMetadata.role as Role | undefined;
  if (currentRole === 'superadmin') return;

  // Check if ANY superadmin exists (Lock mechanism)
  const client = await clerkClient();
  const response = await client.users.getUserList({ limit: 100 });
  const users = response.data;
  
  const superadminExists = users.some((u) => u.publicMetadata.role === 'superadmin');

  if (superadminExists) {
    console.log('Bootstrap locked: Superadmin already exists.');
    return;
  }

  await client.users.updateUserMetadata(user.id, {
    publicMetadata: {
      role: 'superadmin' satisfies Role,
      allowlisted: true,
    },
  });

  console.log(`Bootstrapped superadmin: ${SUPERADMIN_EMAIL}`);
}
