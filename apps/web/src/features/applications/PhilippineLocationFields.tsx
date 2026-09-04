import { useEffect, useState } from 'react'

interface LocationOption {
  code: string
  name: string
}

export interface PhilippineLocationValue {
  regionCode: string
  provinceCode: string
  cityMunicipalityCode: string
  barangayCode: string
}

type LocationField = keyof PhilippineLocationValue

interface PhilippineLocationFieldsProps {
  errors?: Partial<Record<LocationField, string>>
  onChange: (value: PhilippineLocationValue) => void
  value: PhilippineLocationValue
}

function isLocationOption(value: unknown): value is LocationOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'name' in value &&
    typeof value.name === 'string'
  )
}

async function loadLocations(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) throw new Error('LOCATION_REQUEST_FAILED')

  const result: unknown = await response.json()

  if (
    typeof result !== 'object' ||
    result === null ||
    !('locations' in result) ||
    !Array.isArray(result.locations) ||
    !result.locations.every(isLocationOption)
  ) {
    throw new Error('INVALID_LOCATION_RESPONSE')
  }

  return result.locations
}

export function PhilippineLocationFields({
  errors = {},
  onChange,
  value,
}: PhilippineLocationFieldsProps) {
  const [regions, setRegions] = useState<LocationOption[] | null>(null)
  const [provinces, setProvinces] = useState<LocationOption[] | null>(null)
  const [cities, setCities] = useState<LocationOption[] | null>(null)
  const [barangays, setBarangays] = useState<LocationOption[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadLocations('/api/locations/regions', controller.signal)
      .then(setRegions)
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setLoadError('We could not load Philippine locations. Refresh and try again.')
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!value.regionCode) {
      return
    }

    const controller = new AbortController()
    loadLocations(
      `/api/locations/regions/${encodeURIComponent(value.regionCode)}/provinces`,
      controller.signal,
    )
      .then(setProvinces)
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setLoadError('We could not load provinces. Try selecting the region again.')
        }
      })
    return () => controller.abort()
  }, [value.regionCode])

  useEffect(() => {
    if (!value.regionCode || provinces === null) {
      return
    }

    if (provinces.length > 0 && !value.provinceCode) {
      return
    }

    const controller = new AbortController()
    const provinceQuery = value.provinceCode
      ? `?province_code=${encodeURIComponent(value.provinceCode)}`
      : ''
    loadLocations(
      `/api/locations/regions/${encodeURIComponent(value.regionCode)}/cities-municipalities${provinceQuery}`,
      controller.signal,
    )
      .then(setCities)
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setLoadError('We could not load cities and municipalities.')
        }
      })
    return () => controller.abort()
  }, [provinces, value.provinceCode, value.regionCode])

  useEffect(() => {
    if (!value.cityMunicipalityCode) {
      return
    }

    const controller = new AbortController()
    loadLocations(
      `/api/locations/cities-municipalities/${encodeURIComponent(value.cityMunicipalityCode)}/barangays`,
      controller.signal,
    )
      .then(setBarangays)
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setLoadError('We could not load barangays.')
        }
      })
    return () => controller.abort()
  }, [value.cityMunicipalityCode])

  function changeRegion(regionCode: string) {
    setProvinces(null)
    setCities(null)
    setBarangays(null)
    setLoadError(null)
    onChange({
      regionCode,
      provinceCode: '',
      cityMunicipalityCode: '',
      barangayCode: '',
    })
  }

  function changeProvince(provinceCode: string) {
    setCities(null)
    setBarangays(null)
    setLoadError(null)
    onChange({ ...value, provinceCode, cityMunicipalityCode: '', barangayCode: '' })
  }

  function changeCity(cityMunicipalityCode: string) {
    setBarangays(null)
    setLoadError(null)
    onChange({ ...value, cityMunicipalityCode, barangayCode: '' })
  }

  return (
    <div className="space-y-5">
      <LocationSelect
        disabled={regions === null}
        error={errors.regionCode}
        id="regionCode"
        label="Region"
        loading={regions === null}
        onChange={changeRegion}
        options={regions ?? []}
        value={value.regionCode}
      />
      <LocationSelect
        disabled={!value.regionCode || provinces === null || provinces.length === 0}
        emptyLabel={provinces?.length === 0 ? 'Not applicable' : undefined}
        error={errors.provinceCode}
        id="provinceCode"
        label="Province"
        loading={Boolean(value.regionCode) && provinces === null}
        onChange={changeProvince}
        options={provinces ?? []}
        value={value.provinceCode}
      />
      <LocationSelect
        disabled={cities === null}
        error={errors.cityMunicipalityCode}
        id="cityMunicipalityCode"
        label="City or municipality"
        loading={cities === null && (Boolean(value.provinceCode) || provinces?.length === 0)}
        onChange={changeCity}
        options={cities ?? []}
        value={value.cityMunicipalityCode}
      />
      <LocationSelect
        disabled={barangays === null}
        error={errors.barangayCode}
        id="barangayCode"
        label="Barangay"
        loading={Boolean(value.cityMunicipalityCode) && barangays === null}
        onChange={(barangayCode) => onChange({ ...value, barangayCode })}
        options={barangays ?? []}
        value={value.barangayCode}
      />
      {loadError ? <p className="text-sm text-red-700" role="alert">{loadError}</p> : null}
    </div>
  )
}

interface LocationSelectProps {
  disabled: boolean
  emptyLabel?: string
  error?: string
  id: LocationField
  label: string
  loading: boolean
  onChange: (value: string) => void
  options: LocationOption[]
  value: string
}

function LocationSelect({ disabled, emptyLabel, error, id, label, loading, onChange, options, value }: LocationSelectProps) {
  const errorId = `${id}-error`
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>{label}</label>
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={disabled}
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{loading ? `Loading ${label.toLowerCase()}...` : emptyLabel ?? `Select ${label.toLowerCase()}`}</option>
        {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </select>
      {error ? <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}
