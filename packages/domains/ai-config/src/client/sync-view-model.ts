import type {
  CliProvider,
  SyncHealth,
  SyncReason
} from '../shared'

export interface ProviderSyncEntry {
  syncHealth: SyncHealth
  syncReason?: SyncReason | null
}

export interface SyncHealthCounts {
  total: number
  synced: number
  stale: number
  unmanaged: number
  notSynced: number
}

export function contextEntryToSyncHealth(entry: { syncHealth: SyncHealth }): SyncHealth {
  return entry.syncHealth
}

export function countSyncHealths(healths: ReadonlyArray<SyncHealth>): SyncHealthCounts {
  let synced = 0
  let stale = 0
  let unmanaged = 0
  let notSynced = 0

  for (const health of healths) {
    if (health === 'synced') synced += 1
    else if (health === 'stale') stale += 1
    else if (health === 'unmanaged') unmanaged += 1
    else notSynced += 1
  }

  return {
    total: healths.length,
    synced,
    stale,
    unmanaged,
    notSynced
  }
}

export function aggregateProviderSyncHealth(
  providers: Partial<Record<CliProvider, ProviderSyncEntry>>
): SyncHealth {
  const healths = Object.values(providers)
    .filter((provider) => {
      if (!provider) return false
      if (provider.syncReason !== 'not_linked') return true
      return provider.syncHealth === 'unmanaged'
    })
    .map((provider) => provider.syncHealth)

  if (healths.length === 0) return 'not_synced'
  if (healths.some((health) => health === 'stale')) return 'stale'
  if (healths.every((health) => health === 'synced')) return 'synced'
  if (healths.some((health) => health === 'not_synced')) return 'not_synced'
  if (healths.some((health) => health === 'unmanaged')) return 'unmanaged'
  return 'not_synced'
}

export function hasPendingProviderSync(healths: ReadonlyArray<SyncHealth>): boolean {
  return healths.some((health) => health !== 'synced')
}

export function canShowProviderPush(input: {
  syncHealth: SyncHealth
  canPush?: boolean
  isPushing?: boolean
}): boolean {
  const canPush = input.canPush ?? true
  const isPushing = input.isPushing ?? false
  if (!canPush) return false
  return isPushing || input.syncHealth !== 'synced'
}

export function canShowProviderPull(syncHealth: SyncHealth): boolean {
  return syncHealth === 'stale'
}

export function toSyncBadgeLabel(syncHealth: SyncHealth): string {
  if (syncHealth === 'synced') return 'Synced'
  if (syncHealth === 'stale') return 'Stale'
  if (syncHealth === 'unmanaged') return 'Unmanaged'
  return 'Not synced'
}
