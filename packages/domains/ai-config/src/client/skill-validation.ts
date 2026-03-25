import { deriveSkillValidation } from '../shared'
import type { AiConfigItem, SkillValidationState } from '../shared'

export function getSkillValidation(
  item: Pick<AiConfigItem, 'type' | 'slug' | 'content'>
): SkillValidationState | null {
  if (item.type !== 'skill') return null
  return deriveSkillValidation(item.slug, item.content)
}

export function getSkillFrontmatterActionLabel(validation: SkillValidationState | null | undefined): string | null {
  if (!validation || validation.status === 'valid') return null
  return validation.issues.some((issue) => issue.code === 'frontmatter_missing')
    ? 'Add frontmatter'
    : 'Fix frontmatter'
}
