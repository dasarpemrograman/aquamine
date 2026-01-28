export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: 'superadmin' | 'admin'
    }
  }
}
