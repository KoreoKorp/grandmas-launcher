import React from 'react'
import Sidebar from '../components/Sidebar'
import TileGrid from '../components/TileGrid'

export default function HomeView({ config, weather, onTileOpen, onHelpPress }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar
        userName={config.userName}
        dailyNote={config.dailyNote}
        reminders={config.reminders}
        weather={weather}
        onHelpPress={onHelpPress}
      />
      <TileGrid tiles={config.tiles} onTileOpen={onTileOpen} />
    </div>
  )
}
