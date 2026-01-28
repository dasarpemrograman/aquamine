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

  if (currentRole === 'superadmin' && isAllowlisted) return;

  if (currentRole === 'superadmin' && !isAllowlisted) {
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        allowlisted: true,
      },
    });
    return;
  }

  const client = await clerkClient();

  const superadminExists = await (async () => {
    const limit = 100;
    let offset = 0;

    while (true) {
      const response = await client.users.getUserList({ limit, offset });
      const users = Array.isArray(response) ? response : response.data;

      if (users.some((u) => u.publicMetadata.role === 'superadmin')) {
        return true;
      }

      if (Array.isArray(response) || users.length < limit) {
        return false;
      }

      offset += limit;
    }
  })();

  if (superadminExists) {
    console.log('Bootstrap locked: Superadmin already exists.');
    return;
  }

  await client.users.updateUserMetadata(user.id, {
    publicMetadata: {
      ...user.publicMetadata,
      role: 'superadmin' satisfies Role,
      allowlisted: true,
    },
  });

  console.log(`Bootstrapped superadmin: ${SUPERADMIN_EMAIL}`);
}
