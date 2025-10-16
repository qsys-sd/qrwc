import type { IControlChange, ILogger } from '../index.interface.js'
import type { Control } from './Control.js'
import type { WebSocketManager } from './WebSocketManager.js'
import {
  QrwcMinPollInterval,
  QrwcDefaultPollInterval
} from '../constants/index.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Manages a group of Q-Sys components that are monitored for changes. Does not currently support Named Controls
 * Handles polling QRC for control state changes and notifies registered Control callbacks
 */
export class ChangeGroup {
  private intervalRef: ReturnType<typeof setInterval> | null = null
  private readonly id = uuidv4()
  private register = new Map<string, (change: IControlChange) => void>() // Key format is "componentName:controlName"

  constructor(
    private readonly logger: ILogger,
    private readonly websocketManager: WebSocketManager,
    private readonly pollInterval: number = QrwcDefaultPollInterval
  ) {
    this.pollInterval = Math.max(pollInterval, QrwcMinPollInterval)
    this.logger.debug(`ChangeGroup ${this.id} created.`)
  }

  public startPolling(): void {
    if (this.intervalRef) return
    this.intervalRef = setInterval(() => this.poll(), this.pollInterval)
    this.logger.info('ChangeGroup polling started.')
  }

  public stopPolling(): void {
    if (!this.intervalRef) return
    clearInterval(this.intervalRef)
    this.intervalRef = null
    this.logger.info('ChangeGroup polling stopped.')
  }

  public async registerControl(
    control: Control,
    onUpdate: (change: IControlChange) => void
  ): Promise<void> {
    const key = `${control.component.name}:${control.name}`
    this.register.set(key, onUpdate)
    try {
      await this.websocketManager.sendRpc('ChangeGroup.AddComponentControl', {
        Id: this.id,
        Component: {
          Name: control.component.name,
          Controls: [
            {
              Name: control.name
            }
          ]
        }
      })
    } catch (error) {
      this.register.delete(key)
      const message = `QRWC: Failed to register control ${control.name} in component ${control.component.name}.`
      // log error rather than emit b/c client app is still awaiting qrwc factory and can't listen to events
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        this.logger.error(error)
      } else {
        this.logger.error(new Error(`${message}\n${error}`))
      }
    }
  }

  public deregisterControl(control: Control) {
    const key = `${control.component.name}:${control.name}`
    this.register.delete(key)
  }

  private async poll() {
    try {
      const pollResult = await this.websocketManager.sendRpc(
        'ChangeGroup.Poll',
        {
          Id: this.id
        }
      )
      // Invoke the registered callback whenever a change is received.
      pollResult.Changes.forEach((change) => {
        const key = `${change.Component}:${change.Name}`
        if (this.register.has(key)) {
          const callback = this.register.get(key)!
          callback(change)
        }
      })
    } catch (error) {
      const message =
        'QRWC: RPC Error: ChangeGroup.Poll failed to poll for changes.'
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        this.logger.error(error)
      } else {
        const errorObj = new Error(`${message}\n${error}`)
        this.logger.error(errorObj)
      }
    }
  }

  public close() {
    this.stopPolling()
    this.register = new Map<string, (change: IControlChange) => void>()
    this.logger.debug(`ChangeGroup ${this.id} closed.`)
  }
}
