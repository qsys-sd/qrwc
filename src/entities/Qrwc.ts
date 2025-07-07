import type { IStartOptions, IQrwcEvents } from '../index.interface.js'
import { ChangeGroup } from './ChangeGroup.js'
import { Component } from './Component.js'
import { EventEmitter } from '../event/EventEmitter.js'
import { WebSocketManager } from './WebSocketManager.js'

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
    console.log('createQrwc start')
    const websocketManager = await WebSocketManager.createWebSocketManager(
      socket,
      timeout
    )
    console.log('createQrwc: WebSocketManager created.')
    const changeGroup = new ChangeGroup(websocketManager, pollingInterval)
    console.log('createQrwc: ChangeGroup created.')
    const qrwc = new Qrwc<T>(websocketManager, changeGroup)
    console.log('createQrwc: Qrwc created.')

    // we need different ws listeners during startup so we can handle irregular startup issues
    const startupWSErrorHandler = (error: Error) => {
      console.error('QRWC: websocket error during startup')
      console.error(error)
    }
    websocketManager.on('error', startupWSErrorHandler)
    const startupWSDisconnectHandler = (reason: string) => {
      const error = new Error(
        `QRWC: websocket disconnected during startup:\n${reason}`
      )
      console.error(error)
      qrwc.close()
    }
    websocketManager.on('disconnected', startupWSDisconnectHandler)
    console.log('createQrwc: startup listeners created.')

    try {
      console.log('createQrwc: trying to fetch components...')
      const getComponentsResponse = await websocketManager.sendRpc(
        'Component.GetComponents',
        'test'
      )
      console.log('createQrwc: component list fetched.')
      const filteredComponents = componentFilter
        ? getComponentsResponse.filter(componentFilter)
        : getComponentsResponse

      console.log('createQrwc: populating components...')
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
      console.log('createQrwc: components populated with controls.')
      // Freeze the object so it's readonly in javascript too
      qrwc._components = Object.freeze(
        components.reduce<Record<string, Component>>((acc, component) => {
          acc[component.name] = component
          return acc
        }, {})
      )

      changeGroup.startPolling()
    } catch (error) {
      // we should log here instead of emitting b/c this is before the client app
      // has had a chance to listen to qrwc's error event
      const message =
        'QRWC: RPC Error: Component.GetComponents failed to fetch components from the core.'
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        console.error(error)
        throw error
      } else {
        const errorObj = new Error(`${message}\n${error}`)
        console.error(errorObj)
        throw errorObj
      }
    }
    console.log(
      'createQrwc: replacing startup listeners with primary listeners...'
    )
    // replace startup listeners with the real-deal listeners
    websocketManager.removeListener('error', startupWSErrorHandler)
    websocketManager.on('error', (error) => {
      console.log('Qrwc websocketManager error')
      qrwc.emit('error', error)
    })

    websocketManager.removeListener('disconnected', startupWSDisconnectHandler)
    websocketManager.on('disconnected', (reason) => {
      console.log('Qrwc websocketManager disconnect')
      qrwc.emit('disconnected', reason)
      qrwc.close()
    })

    console.log('createQrwc: done.')
    return qrwc
  }

  /**
   * Closes the connection and performs cleanup
   * @public
   */
  public close(): void {
    console.log('Qrwc close()')
    this.changeGroup.close()
    const components = Object.values(this._components)
    components.forEach((component) => {
      component.close()
    })
    this._components = {}
    this.webSocketManager.close()
    this.removeAllListeners()
  }
}
