import { Qrwc, IControlState } from '@q-sys/qrwc'
import WebSocket from 'ws'
import 'dotenv/config'

const setupConnection = async () => {
  const coreIP = process.env.CORE_IP_ADDRESS ?? ''

  const socket = new WebSocket(`ws://${coreIP}/qrc-public-api/v0`)

  const qrwc = await Qrwc.createQrwc<{
    Gain: 'gain' | 'mute'
    Gain_1: 'gain'
    Gain_2: 'gain'
  }>({
    socket,
    pollingInterval: 34
  })

  const gain0 = qrwc.components.Gain.controls.gain
  const gain1 = qrwc.components.Gain_1.controls.gain
  const gain2 = qrwc.components.Gain_2.controls.gain

  const avg = async (_state: IControlState) => {
    await gain0.update(
      ((gain1.state.Value ?? 0) + (gain2.state.Value ?? 0)) / 2
    )
  }

  gain1.on('update', avg)

  gain2.on('update', avg)

  qrwc.on('disconnected', () => {
    setTimeout(() => {
      setupConnection()
    }, 1000)
  })
}
setupConnection()
