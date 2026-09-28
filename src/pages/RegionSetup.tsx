import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppLogo } from '@/components/shared/AppLogo'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { REGION_PRESETS, countryName, detectPreset, findPreset } from '@/config/regions'
import { formatCurrency, formatDate, todayDate } from '@/lib/formatters'
import { regionFromPreset, regionToSettings } from '@/lib/region'
import { supabase } from '@/lib/supabase'

/**
 * Shown after sign-in until the user picks the country they work in. It sets
 * their currency, number and date formats, time zone and cheque rules, all of
 * which can be changed later in Settings.
 */
export default function RegionSetup() {
  const { settings, updateSettings } = useSettings()
  const { signOut } = useAuth()
  const detected = useMemo(() => detectPreset(), [])
  const [country, setCountry] = useState(detected?.preset.country ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When the browser's time zone doesn't match a country we know, start from
  // this instance's default country (instance_config), or the first preset.
  useEffect(() => {
    if (country) return
    let cancelled = false
    void supabase
      .from('instance_config')
      .select('default_country_code')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setCountry(findPreset(data?.default_country_code)?.country ?? REGION_PRESETS[0].country)
      })
    return () => {
      cancelled = true
    }
  }, [country])

  const presets = useMemo(
    () => [...REGION_PRESETS].sort((a, b) => countryName(a.country).localeCompare(countryName(b.country))),
    []
  )

  const preset = findPreset(country)
  const timeZone =
    preset && detected && detected.preset.country === preset.country ? detected.timeZone : preset?.timeZone
  const region = preset ? regionFromPreset(preset, timeZone) : null

  const save = async () => {
    if (!preset || !region) return
    setSaving(true)
    setError(null)
    const result = await updateSettings({
      ...regionToSettings(region),
      // Suggest the country's banks unless the user already has a list.
      ...(settings.banks?.length ? {} : { banks: preset.banks }),
    })
    setSaving(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <AppLogo size="lg" showText={false} />
          </div>
          <CardTitle className="font-title text-3xl">Set up your region</CardTitle>
          <CardDescription>
            Where do you use cheques? This sets your currency, date format and time zone. You can change any of
            them later in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="region-country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="region-country">
                <SelectValue placeholder="Choose your country" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.country} value={p.country}>
                    {countryName(p.country)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Not listed? Pick the closest one, then adjust it in Settings.
            </p>
          </div>

          {region && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <dt className="text-muted-foreground">Amounts</dt>
              <dd className="tabular-nums">{formatCurrency(125000, region)}</dd>
              <dt className="text-muted-foreground">Dates</dt>
              <dd className="tabular-nums">{formatDate(todayDate(region), region)}</dd>
              <dt className="text-muted-foreground">Time zone</dt>
              <dd>{region.timeZone}</dd>
            </dl>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={() => void save()} disabled={!region || saving}>
            {saving ? 'Saving...' : 'Continue'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
