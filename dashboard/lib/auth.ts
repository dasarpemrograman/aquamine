import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export type Role = 'superadmin' | 'admin'

export const checkRole = async (role: Role) => {
  const user = await currentUser()
  return user?.publicMetadata?.role === role
}

export const requireRole = async (role: Role) => {
  const hasRole = await checkRole(role)
  if (!hasRole) {
    redirect('/not-authorized')
  }
}
