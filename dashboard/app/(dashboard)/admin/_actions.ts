'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { checkRole, Role } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function listUsers() {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  const limit = 100
  let offset = 0
  const users = [] as unknown[]

  while (true) {
    const response = await client.users.getUserList({ limit, offset })
    const page = Array.isArray(response) ? response : response.data

    users.push(...page)

    if (Array.isArray(response) || page.length < limit) {
      break
    }

    offset += limit
  }

  return JSON.parse(JSON.stringify(users))
}

type PublicMetadata = Record<string, unknown>

const getPublicMetadata = async (userId: string) => {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  return (user.publicMetadata ?? {}) as PublicMetadata
}

export async function setRole(userId: string, role: Role | null) {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  const currentMetadata = await getPublicMetadata(userId)
  const nextMetadata = {
    ...currentMetadata,
    role: role ?? undefined,
  } as PublicMetadata

  if (role === null) {
    delete (nextMetadata as { role?: unknown }).role
  }

  await client.users.updateUserMetadata(userId, {
    publicMetadata: nextMetadata,
  })
  
  revalidatePath('/admin/users')
  return { success: true }
}

export async function setAllowlisted(userId: string, allowlisted: boolean) {
  if (!await checkRole('superadmin')) {
    throw new Error('Unauthorized')
  }

  const client = await clerkClient()
  const currentMetadata = await getPublicMetadata(userId)
  const nextMetadata = {
    ...currentMetadata,
    allowlisted,
  } as PublicMetadata

  await client.users.updateUserMetadata(userId, {
    publicMetadata: nextMetadata,
  })
  
  revalidatePath('/admin/users')
  return { success: true }
}
