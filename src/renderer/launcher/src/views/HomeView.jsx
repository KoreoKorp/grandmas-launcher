import React from 'react'
import Sidebar from '../components/Sidebar'
import TileGrid from '../components/TileGrid'
import AmbientBackground from '../components/AmbientBackground'
import FamilyRadioOverlay from '../components/FamilyRadioOverlay'

export default function HomeView({ config, weather, onTileOpen, onHelpPress, badges }) {
  // Caregiver "calm" toggle — defaults on; AmbientBackground also self-disables
  // under prefers-reduced-motion.
  const ambientEnabled = config.display?.ambientBackground !== false
  const familyRadioEnabled = config.familyRadio?.enabled !== false

  return (
    <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%' }}>
      <AmbientBackground enabled={ambientEnabled} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%', height: '100%' }}>
        <Sidebar
          userName={config.userName}
          dailyNote={config.dailyNote}
          reminders={config.reminders}
          weather={weather}
          onHelpPress={onHelpPress}
        />
        <TileGrid tiles={config.tiles} onTileOpen={onTileOpen} badges={badges} />
      </div>
      <FamilyRadioOverlay enabled={familyRadioEnabled} baseUrl={config.messenger?.url} />
    </div>
  )
}
