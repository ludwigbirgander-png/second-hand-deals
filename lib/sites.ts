import { db } from './db'
import type { SiteKind } from './types'

export interface EffectiveSite {
  id: string
  site_name: string
  enabled: boolean
  unreliable: boolean
  base_url: string
  kind: SiteKind
}

/**
 * Sites merged with the user's preferences.
 * site_configs.enabled is the global default; a row in user_site_prefs
 * overrides it for that user.
 */
export async function getSitesForUser(userId: string): Promise<EffectiveSite[]> {
  const [{ data: configs }, { data: prefs }] = await Promise.all([
    db().from('site_configs').select('*').order('site_name'),
    db().from('user_site_prefs').select('site_config_id, enabled').eq('user_id', userId),
  ])

  const prefMap = new Map<string, boolean>(
    (prefs ?? []).map((p: { site_config_id: string; enabled: boolean }) => [p.site_config_id, p.enabled])
  )

  return (configs ?? []).map((c: { id: string; site_name: string; enabled: boolean; unreliable: boolean; base_url: string; kind: SiteKind | null }) => ({
    id: c.id,
    site_name: c.site_name,
    enabled: prefMap.get(c.id) ?? c.enabled,
    unreliable: c.unreliable,
    base_url: c.base_url,
    kind: c.kind ?? 'marketplace',
  }))
}

export async function getEnabledSiteNamesForUser(userId: string): Promise<string[]> {
  const sites = await getSitesForUser(userId)
  return sites.filter((s) => s.enabled).map((s) => s.site_name)
}
