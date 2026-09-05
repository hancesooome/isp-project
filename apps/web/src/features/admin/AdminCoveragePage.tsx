import { useCallback, useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import type { Feature, Polygon } from 'geojson'
import 'leaflet/dist/leaflet.css'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'
import { CoverageAreaEditor } from './CoverageAreaEditor'

interface CoverageArea {
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

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isPolygon(value: unknown): value is Polygon {
  if (typeof value !== 'object' || value === null) return false
  const geometry = value as Record<string, unknown>
  if (geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) return false

  return geometry.coordinates.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(
        (position) =>
          Array.isArray(position) &&
          position.length >= 2 &&
          typeof position[0] === 'number' &&
          Number.isFinite(position[0]) &&
          position[0] >= -180 &&
          position[0] <= 180 &&
          typeof position[1] === 'number' &&
          Number.isFinite(position[1]) &&
          position[1] >= -90 &&
          position[1] <= 90,
      ),
  )
}

function isCoverageArea(value: unknown): value is CoverageArea {
  if (typeof value !== 'object' || value === null) return false
  const area = value as Record<string, unknown>

  return (
    typeof area.id === 'string' &&
    typeof area.name === 'string' &&
    isNullableString(area.region_code) &&
    isNullableString(area.region_name) &&
    isNullableString(area.province_code) &&
    isNullableString(area.province_name) &&
    isNullableString(area.city_municipality_code) &&
    isNullableString(area.city_municipality_name) &&
    isNullableString(area.barangay_code) &&
    isNullableString(area.barangay_name) &&
    typeof area.is_active === 'boolean' &&
    isPolygon(area.boundary) &&
    Array.isArray(area.plans) &&
    area.plans.every(
      (plan) =>
        typeof plan === 'object' &&
        plan !== null &&
        'id' in plan &&
        typeof plan.id === 'string' &&
        'name' in plan &&
        typeof plan.name === 'string',
    )
  )
}

export function AdminCoveragePage() {
  const { session } = useAuth()
  const [areas, setAreas] = useState<CoverageArea[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null)

  const loadCoverage = useCallback(async (signal?: AbortSignal) => {
    if (!session) return
    try {
      const response = await fetch('/api/admin/coverage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal,
      })
      if (!response.ok) throw new Error('COVERAGE_REQUEST_FAILED')

      const result: unknown = await response.json()
      if (typeof result !== 'object' || result === null || !('coverage_areas' in result)) throw new Error('INVALID_COVERAGE_RESPONSE')
      const coverageAreas = result.coverage_areas
      if (!Array.isArray(coverageAreas) || !coverageAreas.every(isCoverageArea)) throw new Error('INVALID_COVERAGE_RESPONSE')

      setAreas(coverageAreas)
      setError(null)
      setSelectedId((current) => coverageAreas.some((area) => area.id === current) ? current : coverageAreas[0]?.id ?? null)
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === 'AbortError') return
      setError('We could not load coverage areas. Please try again later.')
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const request = window.setTimeout(() => void loadCoverage(controller.signal), 0)
    return () => {
      window.clearTimeout(request)
      controller.abort()
    }
  }, [loadCoverage, session])

  const selectedArea = areas?.find((area) => area.id === selectedId) ?? null

  return (
    <section className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Coverage</h1>
          <p className="mt-2 text-sm text-slate-400">Manage service boundaries and their available plans.</p>
        </div>
        {editorMode === null ? <button className="min-h-11 rounded-[9px] bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100" onClick={() => setEditorMode('create')} type="button">Create coverage area</button> : null}
      </header>

      {editorMode ? (
        <CoverageAreaEditor
          accessToken={session?.access_token ?? ''}
          area={editorMode === 'edit' ? selectedArea : null}
          onCancel={() => setEditorMode(null)}
          onSaved={() => { setEditorMode(null); void loadCoverage() }}
        />
      ) : <div className="mt-7">
        {error ? (
          <ErrorPanel message={error} title="Coverage unavailable" />
        ) : areas === null ? (
          <PageSkeleton count={4} type="list" />
        ) : areas.length === 0 ? (
          <EmptyState
            description="Coverage polygons will appear here after an administrator creates them."
            title="No coverage areas"
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="admin-coverage-map overflow-hidden rounded-[14px] border border-white/10 bg-[#11161f] shadow-2xl">
              <MapContainer
                center={[12.8797, 121.774]}
                className="h-[32rem] w-full"
                scrollWheelZoom
                zoom={5}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitCoverageAreas areas={areas} />
                {areas.map((area) => (
                  <GeoJSON
                    data={toFeature(area.boundary)}
                    eventHandlers={{ click: () => setSelectedId(area.id) }}
                    key={`${area.id}-${selectedId === area.id}`}
                    pathOptions={{
                      color: selectedId === area.id ? '#42b8ff' : area.is_active ? '#4776ff' : '#94a3b8',
                      fillColor: area.is_active ? '#4776ff' : '#64748b',
                      fillOpacity: selectedId === area.id ? 0.4 : 0.2,
                      weight: selectedId === area.id ? 3 : 2,
                    }}
                  />
                ))}
              </MapContainer>
            </div>

            <aside className="rounded-[14px] border border-white/8 bg-[#11161f] p-5" aria-live="polite">
              {selectedArea ? <CoverageDetails area={selectedArea} onEdit={() => setEditorMode('edit')} /> : null}
              <div className="mt-6 border-t border-white/8 pt-4">
                <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">All areas</p>
                <div className="mt-3 grid gap-1">
                  {areas.map((area) => (
                    <button
                      className={`flex min-h-11 items-center justify-between rounded-[9px] px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selectedId === area.id ? 'bg-white/9 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                      key={area.id}
                      onClick={() => setSelectedId(area.id)}
                      type="button"
                    >
                      <span className="truncate">{area.name}</span>
                      <span className={`ml-3 size-2 shrink-0 rounded-full ${area.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`}>
                        <span className="sr-only">{area.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>}
    </section>
  )
}

function CoverageDetails({ area, onEdit }: { area: CoverageArea; onEdit: () => void }) {
  const location = [
    area.barangay_name,
    area.city_municipality_name,
    area.province_name,
    area.region_name,
  ].filter(Boolean).join(', ')

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">{area.name}</h2>
        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${area.is_active ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-400'}`}>
          {area.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <dl className="mt-5 space-y-4 text-sm">
        <Detail label="Geographic area" value={location || 'Not specified'} />
        <Detail label="Assigned plans" value={area.plans.length > 0 ? area.plans.map((plan) => plan.name).join(', ') : 'No plans assigned'} />
      </dl>
      <button className="mt-5 min-h-11 w-full rounded-[9px] border border-white/10 text-sm font-semibold text-white hover:bg-white/5" onClick={onEdit} type="button">Edit area</button>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 leading-6 text-slate-200">{value}</dd></div>
}

function toFeature(geometry: Polygon): Feature<Polygon> {
  return { type: 'Feature', properties: {}, geometry }
}

function FitCoverageAreas({ areas }: { areas: CoverageArea[] }) {
  const map = useMap()
  const bounds = useMemo(() => {
    const positions = areas.flatMap((area) =>
      area.boundary.coordinates.flatMap((ring) =>
        ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
      ),
    )
    return positions.length > 0 ? latLngBounds(positions) : null
  }, [areas])

  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 })
  }, [bounds, map])

  return null
}
