import React from 'react'
import Tile from './Tile'

export default function TileGrid({ tiles, onTileOpen }) {
  // Use 3 columns for 7+ tiles, 2 columns for 6 or fewer
  const cols = tiles.length >= 7 ? 3 : 2

  return (
    <main style={{ ...styles.grid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {tiles.map(tile => (
        <Tile key={tile.id} tile={tile} onClick={() => onTileOpen(tile)} />
      ))}
    </main>
  )
}

const styles = {
  grid: {
    flex: 1,
    display: 'grid',
    gridAutoRows: '1fr',
    gap: 20,
    padding: 28,
    alignContent: 'center',
    overflowY: 'auto'
  }
}
