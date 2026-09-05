import { useEffect, useState } from 'react'
import type { LeafletMouseEvent, Marker as LeafletMarker } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export interface InstallationCoordinates {
  latitude: number
  longitude: number
}

interface InstallationLocationMapProps {
  error?: string
  onChange: (coordinates: InstallationCoordinates) => void
  value: InstallationCoordinates | null
}

const philippinesCenter: [number, number] = [12.8797, 121.774]

export function InstallationLocationMap({
  error,
  onChange,
  value,
}: InstallationLocationMapProps) {
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Location access is not supported by this browser.')
      return
    }

    setIsLocating(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({ latitude: coords.latitude, longitude: coords.longitude })
        setIsLocating(false)
      },
      () => {
        setLocationError(
          'We could not access your location. Place the pin on the map instead.',
        )
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Requested installation point
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Tap the map to place the pin, then drag it for a more exact location.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-slate-900/14 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
          disabled={isLocating}
          onClick={useCurrentLocation}
          type="button"
        >
          {isLocating ? 'Finding location…' : 'Use my location'}
        </button>
      </div>

      <div
        aria-describedby={error ? 'installation-location-error' : undefined}
        className={`mt-3 overflow-hidden rounded-[14px] border ${error ? 'border-red-400' : 'border-slate-900/14'}`}
      >
        <MapContainer
          center={value ? [value.latitude, value.longitude] : philippinesCenter}
          className="h-80 w-full sm:h-96"
          scrollWheelZoom
          zoom={value ? 17 : 5}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onChange={onChange} />
          <MapViewUpdater value={value} />
          {value ? (
            <Marker
              draggable
              eventHandlers={{
                dragend(event) {
                  const marker = event.target as LeafletMarker
                  const position = marker.getLatLng()
                  onChange({
                    latitude: position.lat,
                    longitude: position.lng,
                  })
                },
              }}
              position={[value.latitude, value.longitude]}
            />
          ) : null}
        </MapContainer>
      </div>

      {value ? (
        <p className="mt-2 text-sm text-slate-500" role="status">
          Pin confirmed at {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No installation point selected.</p>
      )}
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id="installation-location-error" role="alert">
          {error}
        </p>
      ) : null}
      {locationError ? (
        <p className="mt-1.5 text-sm text-red-700" role="alert">
          {locationError}
        </p>
      ) : null}
    </div>
  )
}

function MapViewUpdater({ value }: Pick<InstallationLocationMapProps, 'value'>) {
  const map = useMap()

  useEffect(() => {
    if (value) {
      map.flyTo([value.latitude, value.longitude], 17)
    }
  }, [map, value])

  return null
}

function MapClickHandler({
  onChange,
}: Pick<InstallationLocationMapProps, 'onChange'>) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })

  return null
}
