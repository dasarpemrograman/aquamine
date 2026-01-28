'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { checkRole, Role } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function listUsers(params?: { limit?: number; offset?: number }) {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  const limit = params?.limit ?? 20
  const offset = params?.offset ?? 0

  const [response, totalCount] = await Promise.all([
    client.users.getUserList({ limit, offset }),
    client.users.getCount(),
  ])

  const users = Array.isArray(response) ? response : response.data

  return {
    users: JSON.parse(JSON.stringify(users)),
    totalCount,
  }
}

export async function setRole(userId: string, role: Role | null) {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role },
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
    publicMetadata: { allowlisted },
  })
  
  revalidatePath('/admin/users')
  return { success: true }
}
