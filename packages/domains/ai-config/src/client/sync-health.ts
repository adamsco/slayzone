import type {
  CliProvider,
  SyncReason,
  SyncHealth
} from '../shared'

export function contextEntryToSyncHealth(entry: {
  syncHealth: SyncHealth
}): SyncHealth {
  return entry.syncHealth
}

export function aggregateProviderSyncHealth(
  providers: Partial<Record<CliProvider, {
    syncHealth: SyncHealth
    syncReason?: SyncReason | null
  }>>
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
