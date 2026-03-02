import { applyTheme } from '@slayzone/settings/client'

// Default dark, then resolve persisted preference.
applyTheme('dark')
void window.api.theme.getEffective().then((effective) => {
  applyTheme(effective === 'light' ? 'light' : 'dark')
}).catch(() => {})
