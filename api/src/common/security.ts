const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/

const commonPasswords = new Set([
  'Password@123',
  '1234567890Aa!',
  'Qwerty@123456',
  'Admin@123456'
])

export function isCorporateEmail(email: string, corporateDomain: string) {
  const normalized = email.toLowerCase().trim()
  return normalized.endsWith(`@${corporateDomain}`)
}

export function validateStrongPassword(password: string) {
  return PASSWORD_REGEX.test(password) && !commonPasswords.has(password)
}
