/**
 * Skill validation parser tests
 * Run with: npx tsx packages/domains/ai-config/src/client/skill-validation.test.ts
 */
import { getSkillValidation } from './skill-validation'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed += 1
  } catch (error) {
    console.log(`✗ ${name}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
    failed += 1
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${String(actual)} to be ${String(expected)}`)
    }
  }
}

function buildSkillMetadata(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata)
}

test('status=invalid is authoritative even if issues are empty', () => {
  const validation = getSkillValidation({
    type: 'skill',
    metadata_json: buildSkillMetadata({
      skillValidation: { status: 'invalid', issues: [] }
    })
  })
  expect(validation?.status).toBe('invalid')
})

test('status=valid is authoritative even if stale error issues exist', () => {
  const validation = getSkillValidation({
    type: 'skill',
    metadata_json: buildSkillMetadata({
      skillValidation: {
        status: 'valid',
        issues: [{ code: 'frontmatter_invalid_line', severity: 'error', message: 'stale', line: 1 }]
      }
    })
  })
  expect(validation?.status).toBe('valid')
})

test('missing validation falls back to canonical explicitFrontmatter=true as valid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    metadata_json: buildSkillMetadata({
      skillCanonical: { frontmatter: { name: 'x', description: 'x' }, explicitFrontmatter: true }
    })
  })
  expect(validation?.status).toBe('valid')
})

test('missing validation falls back to canonical explicitFrontmatter=false as invalid', () => {
  const validation = getSkillValidation({
    type: 'skill',
    metadata_json: buildSkillMetadata({
      skillCanonical: { frontmatter: { name: 'x', description: 'x' }, explicitFrontmatter: false }
    })
  })
  expect(validation?.status).toBe('invalid')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
