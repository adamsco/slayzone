export { getStateDir } from './dirs'
export { migrateXdgIfNeeded, migrateCliBinIfNeeded, type MigrationResult } from './migrations'
export { installCli, checkCliInstalled, getCliBinTarget, getManualInstallHint, type CliInstallResult } from './cli-install'
