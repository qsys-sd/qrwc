import React, { createContext, useState, useEffect, useContext } from 'react'
import { Qrwc, Control } from '@q-sys/qrwc'

const QrwcContext = createContext<{
  initialized: boolean
  gain?: Control
  mute?: Control
  text?: Control
}>({
  initialized: false
})

export function useQrwc() {
  return useContext(QrwcContext)
}

export default function QrwcProvider({
  children
}: {
  children: React.JSX.Element
}) {
  const [gain, setGain] = useState<Control>()
  const [mute, setMute] = useState<Control>()
  const [text, setText] = useState<Control>()

  const reconnectDelay = 5000

  /**
   * Setup qrwc and reconnection logic.
   */
  useEffect(() => {
    const setupQrwc = async () => {
      const coreIP = process.env.REACT_APP_CORE_IP_ADDRESS ?? ''
      const socket = new WebSocket(`ws://${coreIP}/qrc-public-api/v0`)
      const qrwc = await Qrwc.createQrwc<{
        Text_Box: 'text.1'
        Gain: 'gain' | 'mute'
      }>({
        socket,
        pollingInterval: 100
      })

      qrwc.on('disconnected', () => {
        setTimeout(setupQrwc, reconnectDelay)
      })

      setGain(qrwc.components.Gain.controls.gain)
      setMute(qrwc.components.Gain.controls.mute)
      setText(qrwc.components.Text_Box.controls['text.1'])

      return qrwc
    }
    const qrwc = setupQrwc()

    return () => {
      qrwc.then((qrwc) => {
        qrwc.close()
      })
    }
  }, [])

  return (
    <QrwcContext.Provider
      value={{
        gain,
        text,
        mute,
        initialized: !!gain && !!mute && !!text
      }}
    >
      {children}
    </QrwcContext.Provider>
  )
}
