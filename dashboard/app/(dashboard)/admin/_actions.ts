'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { checkRole, Role } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function listUsers() {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  const response = await client.users.getUserList({
    limit: 100,
  })

  // Handle both array and paginated response formats just in case
  const users = Array.isArray(response) ? response : response.data

  // Return serializable data
  return JSON.parse(JSON.stringify(users))
}

export async function setRole(userId: string, role: Role) {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role,
    },
  })
  
  revalidatePath('/admin/users')
  return { success: true }
}

export async function setAllowlisted(userId: string, allowlisted: boolean) {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      allowlisted,
    },
  })
  
  revalidatePath('/admin/users')
  return { success: true }
}
