import type { IStartOptions, IQrwcEvents } from '../index.interface'
import { ChangeGroup } from './ChangeGroup'
import { Component } from './Component'
import { EventEmitter } from '../event/EventEmitter'
import { WebSocketManager } from './WebSocketManager'

/**
 * Main entry point for the QRWC library
 * Manages components, controls, and WebSocket communication with the core
 * @extends EventEmitter<IQrwcEvents>
 */
export class Qrwc<
  T extends Record<string, string> = Record<string, string>
> extends EventEmitter<IQrwcEvents> {
  // temporary value--overwritten in createQrwc
  private _components: Readonly<Record<string, Component>> = Object.freeze({})
  private constructor(
    private readonly webSocketManager: WebSocketManager,
    private readonly changeGroup: ChangeGroup
  ) {
    super()
  }

  /**
   * Gets all available components from the core
   * @returns {Readonly<Record<string, Component>>} A read-only record of components, keyed by component name
   * @public
   */
  get components(): Readonly<
    { [U in keyof T]: Component<T[U]> } & Record<string, Component | undefined>
  > {
    return this._components as Readonly<
      { [U in keyof T]: Component<T[U]> } & Record<
        string,
        Component | undefined
      >
    >
  }

  /**
   * Creates and initializes a new Qrwc instance
   * Establishes WebSocket connection, fetches all components from the core and starts polling for changes
   *
   * @param {IStartOptions} options - Configuration options
   * @param {WebSocket} options.socket - WebSocket instance
   * @param {number} [options.pollingInterval] - Interval in milliseconds for polling the change group
   * @param {(state: IComponentState) => boolean} [options.componentFilter] - Function to filter components in design
   * @param {number} [options.timeout] - Timeout in milliseconds for websocket messages
   * @returns {Promise<Qrwc>} A fully initialized Qrwc instance
   * @public
   * @static
   */
  public static async createQrwc<
    T extends Record<string, string> = Record<string, string>
  >({
    socket,
    pollingInterval,
    componentFilter,
    timeout = 5000
  }: IStartOptions): Promise<Qrwc<T>> {
    try {
      if (socket.readyState !== socket.OPEN) {
        await new Promise<void>((resolve, reject) => {
          const timeoutRef = setTimeout(reject, timeout)
          socket.onopen = () => {
            clearTimeout(timeoutRef)
            resolve()
          }
        })
      }
    } catch (_) {
      throw new Error('QRWC: Websocket error: Unable to connect to core.')
    }

    const websocketManager = new WebSocketManager(socket, timeout)
    const changeGroup = new ChangeGroup(websocketManager, pollingInterval)

    const qrwc = new Qrwc<T>(websocketManager, changeGroup)

    websocketManager.on('error', (error) => {
      qrwc.emit('error', error)
    })
    websocketManager.on('disconnected', (reason) => {
      qrwc.emit('disconnected', reason)
      qrwc.close()
    })

    try {
      const getComponentsResponse = await websocketManager.sendRpc(
        'Component.GetComponents',
        'test'
      )

      const filteredComponents = componentFilter
        ? getComponentsResponse.filter(componentFilter)
        : getComponentsResponse

      const components = await Promise.all(
        filteredComponents.map((component) => {
          return Component.createComponent(
            websocketManager,
            changeGroup,
            qrwc,
            component.Name,
            component // add whole obj so users can access props qrwc doesn't know about
          )
        })
      )

      // Freeze the object so it's readonly in javascript too
      qrwc._components = Object.freeze(
        components.reduce<Record<string, Component>>((acc, component) => {
          acc[component.name] = component
          return acc
        }, {})
      )
    } catch (error) {
      // we should log here instead of emitting b/c this is before the client app
      // has had a chance to listen to qrwc's error event
      const message =
        'QRWC: RPC Error: Component.GetComponents failed to fetch components from the core.'
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        console.error(error)
      } else {
        console.error(new Error(`${message}\n${error}`))
      }
    }

    changeGroup.startPolling()

    return qrwc
  }

  /**
   * Closes the connection and performs cleanup
   * @public
   */
  public close(): void {
    this.changeGroup.stopPolling()
    this.changeGroup.cleanUp()
    const components = Object.values(this._components)
    components.forEach((component) => {
      component.cleanUp()
    })
    this._components = {}
    this.removeAllListeners()
    this.webSocketManager.close()
  }
}
