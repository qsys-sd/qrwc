import './App.css'
import React from 'react'
import GainSlider from './components/GainSlider'
import GainMute from './components/GainMute'
import TextBox from './components/TextBox'
import { Box, Stack, Typography } from '@mui/material'
import { useQrwc } from './context/QrwcContext'

function App() {
  const { initialized } = useQrwc()

  if (!initialized) {
    return <div>Initializing...</div>
  }

  return (
    <div className="App">
      <Box sx={{ width: '100%', margin: 'auto' }}>
        <Typography variant="h2" sx={{ color: 'primary.main' }}>
          QRWC REACT/MUI DEMO
        </Typography>
      </Box>
      <Stack
        spacing={2}
        direction="row"
        sx={{ mb: 1 }}
        alignItems="center"
        justifyContent="space-between"
      >
        <TextBox />
        <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
          <GainSlider />
          <GainMute />
        </Stack>
      </Stack>
    </div>
  )
}

export default App
