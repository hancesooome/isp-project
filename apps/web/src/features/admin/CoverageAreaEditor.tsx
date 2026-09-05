import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CircleMarker, MapContainer, Polygon as LeafletPolygon, TileLayer, useMapEvents } from 'react-leaflet'
import type { Polygon } from 'geojson'

interface PlanOption { id: string; name: string; is_active: boolean }

export interface EditableCoverageArea {
  id: string
  name: string
  region_code: string | null
  region_name: string | null
  province_code: string | null
  province_name: string | null
  city_municipality_code: string | null
  city_municipality_name: string | null
  barangay_code: string | null
  barangay_name: string | null
  is_active: boolean
  boundary: Polygon
  plans: Array<{ id: string; name: string }>
}

interface Props {
  area: EditableCoverageArea | null
  accessToken: string
  onCancel: () => void
  onSaved: () => void
}

type Point = [number, number]

const inputClass = 'mt-1.5 min-h-11 w-full rounded-[9px] border border-white/10 bg-[#0b1018] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20'

export function CoverageAreaEditor({ area, accessToken, onCancel, onSaved }: Props) {
  const [name, setName] = useState(area?.name ?? '')
  const [regionName, setRegionName] = useState(area?.region_name ?? '')
  const [provinceName, setProvinceName] = useState(area?.province_name ?? '')
  const [cityName, setCityName] = useState(area?.city_municipality_name ?? '')
  const [barangayName, setBarangayName] = useState(area?.barangay_name ?? '')
  const [isActive, setIsActive] = useState(area?.is_active ?? true)
  const [points, setPoints] = useState<Point[]>(() =>
    area?.boundary.coordinates[0]?.slice(0, -1).map((position) => [position[1]!, position[0]!] as Point) ?? [],
  )
  const [plans, setPlans] = useState<PlanOption[] | null>(null)
  const [selectedPlanIds, setSelectedPlanIds] = useState(() => new Set(area?.plans.map((plan) => plan.id) ?? []))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function loadPlans() {
      try {
        const response = await fetch('/api/admin/plans', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (typeof result !== 'object' || result === null || !('plans' in result) || !Array.isArray(result.plans)) throw new Error()
        const parsed = result.plans.filter((plan): plan is PlanOption =>
          typeof plan === 'object' && plan !== null && 'id' in plan && typeof plan.id === 'string' &&
          'name' in plan && typeof plan.name === 'string' && 'is_active' in plan && typeof plan.is_active === 'boolean',
        )
        setPlans(parsed)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('Plans could not be loaded.')
      }
    }
    void loadPlans()
    return () => controller.abort()
  }, [accessToken])

  const polygon = useMemo(() => points.length >= 3 ? points : [], [points])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim().length < 2) { setError('Enter a coverage area name.'); return }
    if (points.length < 3) { setError('Draw at least three boundary points on the map.'); return }
    if (area?.is_active && !isActive && !window.confirm('Deactivate this coverage area? It will no longer be available for new service checks.')) return

    const firstPoint = points[0]!
    const outerRing = [...points.map(([lat, lng]) => [lng, lat]), [firstPoint[1], firstPoint[0]]]
    const keepCode = (currentName: string | null, editedName: string, code: string | null) =>
      (currentName ?? '') === editedName.trim() ? code : null
    const body = {
      name: name.trim(),
      region_code: keepCode(area?.region_name ?? null, regionName, area?.region_code ?? null),
      region_name: regionName.trim() || null,
      province_code: keepCode(area?.province_name ?? null, provinceName, area?.province_code ?? null),
      province_name: provinceName.trim() || null,
      city_municipality_code: keepCode(area?.city_municipality_name ?? null, cityName, area?.city_municipality_code ?? null),
      city_municipality_name: cityName.trim() || null,
      barangay_code: keepCode(area?.barangay_name ?? null, barangayName, area?.barangay_code ?? null),
      barangay_name: barangayName.trim() || null,
      is_active: isActive,
      boundary: { type: 'Polygon', coordinates: [outerRing, ...(area?.boundary.coordinates.slice(1) ?? [])] },
      plan_ids: [...selectedPlanIds],
    }

    setSaving(true)
    try {
      const response = await fetch(area ? `/api/admin/coverage/${area.id}` : '/api/admin/coverage', {
        method: area ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null)
        const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string' ? result.error : 'Unable to save coverage area.'
        throw new Error(message)
      }
      onSaved()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save coverage area.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_24rem]" onSubmit={handleSubmit}>
      <div>
        <div className="overflow-hidden rounded-[14px] border border-white/10 bg-[#11161f]">
          <MapContainer center={points[0] ?? [12.8797, 121.774]} className="h-[32rem] w-full" zoom={points.length ? 13 : 5}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <BoundaryDrawing setPoints={setPoints} />
            {polygon.length >= 3 ? <LeafletPolygon pathOptions={{ color: '#42b8ff', fillColor: '#4776ff', fillOpacity: 0.25 }} positions={polygon} /> : null}
            {points.map((point, index) => <CircleMarker center={point} key={`${point.join('-')}-${index}`} pathOptions={{ color: '#fff', fillColor: '#42b8ff', fillOpacity: 1 }} radius={5} />)}
          </MapContainer>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-slate-400">Click or tap the map to add points in order. {points.length} point{points.length === 1 ? '' : 's'}.</p>
          <div className="flex gap-2">
            <button className="rounded-[8px] border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/5 disabled:opacity-40" disabled={!points.length} onClick={() => setPoints((current) => current.slice(0, -1))} type="button">Undo point</button>
            <button className="rounded-[8px] border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/5 disabled:opacity-40" disabled={!points.length} onClick={() => setPoints([])} type="button">Redraw</button>
          </div>
        </div>
      </div>

      <aside className="rounded-[14px] border border-white/8 bg-[#11161f] p-5">
        <h2 className="text-xl font-semibold text-white">{area ? 'Edit coverage area' : 'Create coverage area'}</h2>
        <div className="mt-5 grid gap-4">
          <TextField label="Area name" required value={name} onChange={setName} />
          <TextField label="Region" value={regionName} onChange={setRegionName} />
          <TextField label="Province" value={provinceName} onChange={setProvinceName} />
          <TextField label="City / municipality" value={cityName} onChange={setCityName} />
          <TextField label="Barangay" value={barangayName} onChange={setBarangayName} />
          <fieldset>
            <legend className="text-sm font-medium text-slate-200">Available plans</legend>
            <div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-[9px] border border-white/10 p-3">
              {plans === null ? <p className="text-sm text-slate-500">Loading plans…</p> : plans.length === 0 ? <p className="text-sm text-slate-500">No plans available.</p> : plans.map((plan) => (
                <label className="flex items-center gap-2 text-sm text-slate-300" key={plan.id}>
                  <input checked={selectedPlanIds.has(plan.id)} onChange={(event) => setSelectedPlanIds((current) => { const next = new Set(current); if (event.target.checked) next.add(plan.id); else next.delete(plan.id); return next })} type="checkbox" />
                  <span>{plan.name}{plan.is_active ? '' : ' (inactive)'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-slate-200"><input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> Active for availability checks</label>
          {error ? <p className="rounded-[8px] border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button className="min-h-11 flex-1 rounded-[9px] border border-white/10 text-sm font-semibold text-slate-200 hover:bg-white/5" disabled={saving} onClick={onCancel} type="button">Cancel</button>
            <button className="min-h-11 flex-1 rounded-[9px] bg-gradient-to-r from-[#18243a] to-[#4b4de1] text-sm font-semibold text-white disabled:opacity-50" disabled={saving || plans === null} type="submit">{saving ? 'Saving…' : 'Save area'}</button>
          </div>
        </div>
      </aside>
    </form>
  )
}

function BoundaryDrawing({ setPoints }: { setPoints: React.Dispatch<React.SetStateAction<Point[]>> }) {
  useMapEvents({ click: (event) => setPoints((current) => [...current, [event.latlng.lat, event.latlng.lng]]) })
  return null
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="text-sm font-medium text-slate-200">{label}<input className={inputClass} maxLength={120} onChange={(event) => onChange(event.target.value)} required={required} value={value} /></label>
}
