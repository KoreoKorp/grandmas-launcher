import React, { useState } from 'react'

function newLocation() {
  return { id: Date.now().toString(), name: '' }
}

export default function WeatherSettings({ weather, onSave }) {
  const initial = weather.locations?.length
    ? weather.locations
    : weather.location ? [{ id: '0', name: weather.location }] : []

  const [locations, setLocations] = useState(initial)
  const [unit, setUnit] = useState(weather.unit ?? 'F')
  const [saved, setSaved] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [liveWeathers, setLiveWeathers] = useState(
    weather.cached ? [weather.cached] : []
  )

  function updateLocation(id, name) {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, name } : l))
  }

  function addLocation() {
    setLocations(prev => [...prev, newLocation()])
  }

  function removeLocation(id) {
    setLocations(prev => prev.filter(l => l.id !== id))
  }

  async function save() {
    const clean = locations.filter(l => l.name.trim())
    await onSave({
      locations: clean,
      location: clean[0]?.name ?? '',
      unit
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function refresh() {
    setRefreshing(true)
    const result = await window.admin.refreshWeather()
    setLiveWeathers(Array.isArray(result) ? result : result ? [result] : [])
    setRefreshing(false)
  }

  return (
    <div>
      <h2>Weather Settings</h2>

      <div className="card">
        <div className="field">
          <label>Temperature Unit</label>
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: 'auto' }}>
            <option value="F">Fahrenheit (°F)</option>
            <option value="C">Celsius (°C)</option>
          </select>
        </div>

        <label style={{ display: 'block', marginBottom: 10, fontWeight: 600 }}>
          Locations
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {locations.map((loc, i) => (
            <div key={loc.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)', width: 20, textAlign: 'right', flexShrink: 0 }}>
                {i + 1}.
              </span>
              <input
                value={loc.name}
                onChange={e => updateLocation(loc.id, e.target.value)}
                placeholder="e.g. New York, NY  or  10001"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-danger"
                style={{ padding: '6px 10px' }}
                onClick={() => removeLocation(loc.id)}
                title="Remove this location"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 10 }}
          onClick={addLocation}
        >
          + Add Location
        </button>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Fetching…' : '↻ Refresh Now'}
          </button>
          {saved && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      {liveWeathers.length > 0 && (
        <div className="card">
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85em', marginBottom: 12 }}>
            Current weather
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {liveWeathers.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.6em' }}>{w.icon}</span>
                <div>
                  <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                    {w.temp}°{w.unit} — {w.condition}
                  </div>
                  {w.locationName && (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.85em', marginTop: 2 }}>
                      📍 {w.locationName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {liveWeathers.length === 0 && (
        <div className="card">
          <div style={{ color: 'var(--text-dim)' }}>
            No weather data yet. Add a location and click Refresh Now.
          </div>
        </div>
      )}
    </div>
  )
}
