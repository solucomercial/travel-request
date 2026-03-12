import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { query } from './pool'

let initialized = false

export async function initializeDatabase() {
  if (initialized) {
    return
  }

  const schemaPath = join(process.cwd(), 'src', 'infra', 'db', 'schema.sql')
  const sql = readFileSync(schemaPath, 'utf-8')

  await query(sql)

  initialized = true
}
