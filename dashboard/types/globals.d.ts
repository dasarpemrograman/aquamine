export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: 'superadmin' | 'admin'
      allowlisted?: boolean
    }
    publicMetadata?: {
      role?: 'superadmin' | 'admin'
      allowlisted?: boolean
    }
  }
}
