import { store } from './store.js'

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function clearWeatherCache() {
  store.set('weather.cachedAt', null)
  store.set('weather.cached', null)
  store.set('weather.locationCaches', {})
}

// Fetch weather for a single named location string. Results are cached
// per-location in weather.locationCaches keyed by the location name.
export async function fetchWeatherForLocation(locationName, unit) {
  if (!locationName) return null

  const caches = store.get('weather.locationCaches') || {}
  const cached = caches[locationName]
  if (cached?.data && cached?.at && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1`
    )
    const geoData = await geoRes.json()
    if (!geoData.results?.length) return null

    const { latitude, longitude, name } = geoData.results[0]
    const tempUnit = unit === 'F' ? 'fahrenheit' : 'celsius'
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=${tempUnit}&windspeed_unit=mph&daily=sunset&timezone=auto`
    )
    const weatherData = await weatherRes.json()
    const current = weatherData.current
    const daily = weatherData.daily || {}
    const sunsetISO = daily.sunset?.length > 0 ? daily.sunset[0] : null

    const result = {
      temp: Math.round(current.temperature_2m),
      unit,
      condition: wmoCodeToCondition(current.weathercode),
      icon: wmoCodeToIcon(current.weathercode),
      locationName: name,
      sunset: sunsetISO
    }

    caches[locationName] = { data: result, at: Date.now() }
    store.set('weather.locationCaches', caches)
    return result
  } catch (e) {
    console.error('Weather fetch failed:', e)
    return caches[locationName]?.data ?? null
  }
}

// Fetch weather for all configured locations. Returns an array of results in
// the same order as the locations[] array in the store.
export async function fetchWeather() {
  const { locations = [], unit } = store.get('weather')

  // Legacy fallback: if no locations array exists yet use old single location
  if (!locations.length) {
    const { location } = store.get('weather')
    if (!location) return []
    const result = await fetchWeatherForLocation(location, unit)
    return result ? [result] : []
  }

  const results = await Promise.all(
    locations.map(loc => fetchWeatherForLocation(loc.name, unit))
  )
  return results.filter(Boolean)
}

function wmoCodeToCondition(code) {
  if (code === 0) return 'Clear sky'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 59) return 'Drizzle'
  if (code <= 69) return 'Rain'
  if (code <= 79) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

function wmoCodeToIcon(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 49) return '🌫️'
  if (code <= 69) return '🌧️'
  if (code <= 79) return '🌨️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '❄️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}
