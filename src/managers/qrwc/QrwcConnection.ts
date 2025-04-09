import { Qrwc } from './Qrwc'
import { IComponent, ISetupQrwcParams } from '../../index.interface'

export const setupQrwc = ({
  coreIpAddress,
  maxReconnectAttempts = 0,
  reconnectDelay = 500,
  componentFilter,
  pollingInterval,
  onError,
  onDisconnect,
  onStartComplete,
  onControlsUpdated,
  onComponentsReceived
}: ISetupQrwcParams) => {
  let reconnectAttempts = 0

  let socket: WebSocket | null = null

  const connectQrwc = async () => {
    socket = new WebSocket(`ws://${coreIpAddress}/qrc-public-api/v0`)

    const qrwc = new Qrwc()
    await qrwc.initialized // needed in node envs because of a dynamic import

    if (onError) {
      qrwc.on('error', (error: unknown) => onError(qrwc, error))
    }
    if (onDisconnect) {
      qrwc.on('disconnected', (event: string) => onDisconnect(qrwc, event))
    }
    if (onStartComplete) {
      qrwc.on('startComplete', () => onStartComplete(qrwc))
    }
    if (onControlsUpdated) {
      qrwc.on('controlsUpdated', (updatedComponent: IComponent) =>
        onControlsUpdated(qrwc, updatedComponent)
      )
    }
    if (onComponentsReceived) {
      qrwc.on('componentsReceived', (components: Record<string, IComponent>) =>
        onComponentsReceived(qrwc, components)
      )
    }

    socket.onopen = async () => {
      reconnectAttempts = 0
      await qrwc.attachWebSocket(socket)
      await qrwc.start({
        componentFilter,
        pollingInterval
      })
    }

    socket.onerror = (error) => {
      onError && onError(qrwc, error)

      if (reconnectAttempts++ < maxReconnectAttempts) {
        setTimeout(connectQrwc, reconnectDelay)
      }
    }
  }

  connectQrwc()

  return { closeQrwc: () => socket?.close() } // return an obj so we can add to it later w/o breaking changes
}
