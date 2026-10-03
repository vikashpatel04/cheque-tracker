import { REGION_PRESETS, detectPreset, findPreset } from '@/config/regions'
import { authMessage } from '@/lib/authMessage'
import { regionFromPreset, regionToSettings, type Region } from '@/lib/region'
import { supabase } from '@/lib/supabase'

/**
 * The demo (plan item 86, migration 023): a private, throwaway account for
 * looking around without signing up. Supabase's anonymous sign-in gives the
 * account, start_demo() fills it with made-up cheques, and end_demo() deletes
 * it. The database keeps demos in bounds: a day of access, limits on what
 * they hold, and no buying or importing.
 */

/** The region a visitor most likely uses: their browser's, or this instance's default. */
async function suggestedRegion(): Promise<Region> {
  const detected = detectPreset()
  if (detected) return regionFromPreset(detected.preset, detected.timeZone)
  const { data } = await supabase.from('instance_config').select('default_country_code').maybeSingle()
  return regionFromPreset(findPreset(data?.default_country_code) ?? REGION_PRESETS[0])
}

/**
 * Signs in anonymously and fills the new account, in the visitor's region.
 * captchaToken: from useCaptcha, when the bot check is on. If the demo can't
 * start, the empty account is deleted again.
 */
export async function startDemo(captchaToken?: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } })
  if (error) return { error: authMessage(error.message) }
  const region = await suggestedRegion()
  const { error: startError } = await supabase.rpc('start_demo', { p_region: regionToSettings(region) })
  if (startError) {
    await endDemo()
    return { error: startError.message }
  }
  return {}
}

/** Deletes the demo account and everything in it, and forgets it in this browser. */
export async function endDemo(): Promise<void> {
  // If deleting fails (offline, say), the demo is deleted within a day anyway.
  await supabase.rpc('end_demo')
  await supabase.auth.signOut({ scope: 'local' })
}
