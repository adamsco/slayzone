import type { AiConfigItem, SkillValidationIssue, SkillValidationState } from '../shared'

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore malformed metadata
  }
  return {}
}

export function getSkillValidation(item: Pick<AiConfigItem, 'type' | 'metadata_json'>): SkillValidationState | null {
  if (item.type !== 'skill') return null
  const parsed = parseJsonObject(item.metadata_json)
  const raw = parsed.skillValidation
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    const canonical = parsed.skillCanonical
    const explicitFrontmatter = !!(
      canonical
      && typeof canonical === 'object'
      && !Array.isArray(canonical)
      && (canonical as Record<string, unknown>).explicitFrontmatter === true
    )
    if (explicitFrontmatter) {
      return { status: 'valid', issues: [] }
    }
    return {
      status: 'invalid',
      issues: [{
        code: 'frontmatter_missing',
        severity: 'error',
        message: 'Skill is missing frontmatter. Add a leading "---" block with name/description.',
        line: 1
      }]
    }
  }

  const rawObj = raw as Record<string, unknown>
  const status =
    rawObj.status === 'valid' || rawObj.status === 'warning' || rawObj.status === 'invalid'
      ? rawObj.status
      : null
  const rawIssues = Array.isArray(rawObj.issues) ? rawObj.issues : []
  const issues: SkillValidationIssue[] = []
  for (const rawIssue of rawIssues) {
    if (!rawIssue || typeof rawIssue !== 'object' || Array.isArray(rawIssue)) continue
    const issue = rawIssue as Record<string, unknown>
    const severity = issue.severity
    if (severity !== 'error' && severity !== 'warning') continue
    issues.push({
      code: typeof issue.code === 'string' ? issue.code : 'unknown',
      severity,
      message: typeof issue.message === 'string' ? issue.message : 'Validation issue',
      line: typeof issue.line === 'number' ? issue.line : null
    })
  }

  if (status) {
    return { status, issues }
  }

  const hasErrors = issues.some((issue) => issue.severity === 'error')
  const hasWarnings = issues.some((issue) => issue.severity === 'warning')
  return {
    status: hasErrors ? 'invalid' : hasWarnings ? 'warning' : 'valid',
    issues
  }
}
