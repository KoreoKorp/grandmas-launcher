import React, { useState } from 'react'

export default function WeatherSettings({ weather, onSave }) {
  const [location, setLocation] = useState(weather.location)
  const [unit, setUnit] = useState(weather.unit)
  const [saved, setSaved] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [liveWeather, setLiveWeather] = useState(weather.cached)

  async function save() {
    await onSave({ location, unit })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function refresh() {
    setRefreshing(true)
    const result = await window.admin.refreshWeather()
    setLiveWeather(result)
    setRefreshing(false)
  }

  const display = liveWeather

  return (
    <div>
      <h2>Weather Settings</h2>
      <div className="card">
        <div className="field">
          <label>Location (city name or zip code)</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. New York, NY"
          />
        </div>
        <div className="field">
          <label>Temperature Unit</label>
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: 'auto' }}>
            <option value="F">Fahrenheit (°F)</option>
            <option value="C">Celsius (°C)</option>
          </select>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Fetching…' : '↻ Refresh Now'}
          </button>
          {saved && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      <div className="card">
        <div style={{ color: 'var(--text-dim)', fontSize: '0.85em', marginBottom: 8 }}>Current weather</div>
        {display ? (
          <>
            <div style={{ fontSize: '1.2em', fontWeight: 600 }}>
              {display.icon} {display.temp}°{display.unit} — {display.condition}
            </div>
            {display.locationName && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85em', marginTop: 4 }}>
                📍 {display.locationName}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-dim)' }}>
            No data yet. Set a location and click Refresh Now.
          </div>
        )}
      </div>
    </div>
  )
}
