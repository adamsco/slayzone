/**
 * Context manager sync view-model tests
 * Run with: npx tsx packages/domains/ai-config/src/client/sync-view-model.test.ts
 */
import {
  aggregateProviderSyncHealth,
  canShowProviderPull,
  canShowProviderPush,
  hasPendingProviderSync,
  toSyncBadgeLabel,
  type ProviderSyncEntry
} from './sync-view-model'

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

const linkedSynced: ProviderSyncEntry = { syncHealth: 'synced', syncReason: null }
const linkedStale: ProviderSyncEntry = { syncHealth: 'stale', syncReason: 'external_edit' }
const linkedNotSynced: ProviderSyncEntry = { syncHealth: 'not_synced', syncReason: null }
const unlinkedMissing: ProviderSyncEntry = { syncHealth: 'not_synced', syncReason: 'not_linked' }
const unlinkedUnmanaged: ProviderSyncEntry = { syncHealth: 'unmanaged', syncReason: 'not_linked' }

test('aggregateProviderSyncHealth prefers stale over other linked states', () => {
  expect(aggregateProviderSyncHealth({
    claude: linkedSynced,
    codex: linkedStale
  })).toBe('stale')
})

test('aggregateProviderSyncHealth ignores unlinked not_synced entries', () => {
  expect(aggregateProviderSyncHealth({
    claude: linkedSynced,
    codex: unlinkedMissing
  })).toBe('synced')
})

test('aggregateProviderSyncHealth surfaces unmanaged when present', () => {
  expect(aggregateProviderSyncHealth({
    codex: linkedSynced,
    claude: unlinkedUnmanaged
  })).toBe('unmanaged')
})

test('aggregateProviderSyncHealth falls back to not_synced when only unlinked missing files exist', () => {
  expect(aggregateProviderSyncHealth({
    claude: unlinkedMissing,
    codex: unlinkedMissing
  })).toBe('not_synced')
})

test('toSyncBadgeLabel maps every sync health to stable text', () => {
  expect(toSyncBadgeLabel('synced')).toBe('Synced')
  expect(toSyncBadgeLabel('stale')).toBe('Stale')
  expect(toSyncBadgeLabel('unmanaged')).toBe('Unmanaged')
  expect(toSyncBadgeLabel('not_synced')).toBe('Not synced')
})

test('canShowProviderPush hides push for synced rows unless actively pushing', () => {
  expect(canShowProviderPush({ syncHealth: 'synced', canPush: true, isPushing: false })).toBe(false)
  expect(canShowProviderPush({ syncHealth: 'synced', canPush: true, isPushing: true })).toBe(true)
})

test('canShowProviderPush respects write capability', () => {
  expect(canShowProviderPush({ syncHealth: 'stale', canPush: false, isPushing: false })).toBe(false)
  expect(canShowProviderPush({ syncHealth: 'stale', canPush: true, isPushing: false })).toBe(true)
})

test('canShowProviderPull only shows for stale rows', () => {
  expect(canShowProviderPull('stale')).toBe(true)
  expect(canShowProviderPull('synced')).toBe(false)
  expect(canShowProviderPull('unmanaged')).toBe(false)
  expect(canShowProviderPull('not_synced')).toBe(false)
})

test('hasPendingProviderSync returns true when any provider is not synced', () => {
  expect(hasPendingProviderSync(['synced', 'synced'])).toBe(false)
  expect(hasPendingProviderSync(['synced', 'stale'])).toBe(true)
  expect(hasPendingProviderSync(['not_synced'])).toBe(true)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
