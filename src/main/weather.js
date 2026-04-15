import { store } from './store.js'

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function clearWeatherCache() {
  store.set('weather.cachedAt', null)
  store.set('weather.cached', null)
}

export async function fetchWeather() {
  const { location, unit } = store.get('weather')
  if (!location) return null

  const { cachedAt, cached } = store.get('weather')
  if (cached && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached
  }

  try {
    const unitParam = unit === 'F' ? 'imperial' : 'metric'
    // Uses Open-Meteo (no API key needed) with geocoding fallback
    // First geocode the location
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
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
    const sunsetISO = daily.sunset && daily.sunset.length > 0 ? daily.sunset[0] : null

    const result = {
      temp: Math.round(current.temperature_2m),
      unit,
      condition: wmoCodeToCondition(current.weathercode),
      icon: wmoCodeToIcon(current.weathercode),
      locationName: name,
      sunset: sunsetISO
    }

    store.set('weather.cached', result)
    store.set('weather.cachedAt', Date.now())
    return result
  } catch (e) {
    console.error('Weather fetch failed:', e)
    return store.get('weather.cached') // return stale cache on error
  }
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
