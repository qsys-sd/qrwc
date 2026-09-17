import type {
  IControlChange,
  ILogger,
  IQrwcExpandedGenericParameter
} from '../index.interface.js'
import type { Control } from './Control.js'
import type { QrcClient } from '../connection/QrcClient.js'
import {
  QrwcMinPollInterval,
  QrwcDefaultPollInterval
} from '../constants/index.js'
import { v4 as uuidv4 } from 'uuid'

// A registered control, kept in full (not a bare callback) so it can be
// re-added to the core after a reconnect without brittle key-splitting.
interface IRegisteredControl {
  componentName: string
  controlName: string
  onUpdate: (change: IControlChange) => void
}

/**
 * Manages a group of Q-Sys components that are monitored for changes. Does not currently support Named Controls
 * Handles polling QRC for control state changes and notifies registered Control callbacks
 */
export class ChangeGroup<T extends IQrwcExpandedGenericParameter> {
  private intervalRef: ReturnType<typeof setInterval> | null = null
  private readonly id = uuidv4()
  private register = new Map<string, IRegisteredControl>() // Key format is "componentName:controlName"

  constructor(
    private readonly logger: ILogger,
    private readonly qrcClient: QrcClient,
    private readonly pollInterval: number = QrwcDefaultPollInterval
  ) {
    this.pollInterval = Math.max(pollInterval, QrwcMinPollInterval)
    this.logger.debug(`ChangeGroup ${this.id} created.`)
  }

  public startPolling = async (): Promise<void> => {
    if (this.intervalRef) return
    this.intervalRef = setInterval(() => this.poll(), this.pollInterval)
    this.logger.debug('ChangeGroup polling started.')
    return this.poll()
  }

  public stopPolling = (): void => {
    if (!this.intervalRef) return
    clearInterval(this.intervalRef)
    this.intervalRef = null
    this.logger.debug('ChangeGroup polling stopped.')
  }

  public registerControl = async (
    control: Control<
      T,
      keyof T['components'],
      keyof T['components'][keyof T['components']]['controls']
    >,
    onUpdate: (change: IControlChange) => void
  ): Promise<void> => {
    const componentName = control.component.name
    const controlName = control.name
    const key = `${componentName}:${controlName}`
    this.register.set(key, { componentName, controlName, onUpdate })
    try {
      await this.addControlToCore(componentName, controlName)
    } catch (error) {
      this.register.delete(key)
      const message = `QRWC: Failed to register control ${controlName} in component ${componentName}.`
      // log error rather than emit b/c client app is still awaiting qrwc factory and can't listen to events
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        this.logger.error(error)
      } else {
        this.logger.error(new Error(`${message}\n${error}`))
      }
    }
  }

  // After a reconnect the core's fresh session has forgotten our change-group id,
  // so every control must be re-added or polling returns nothing.
  public reregisterAll = async (): Promise<void> => {
    for (const { componentName, controlName } of this.register.values()) {
      try {
        await this.addControlToCore(componentName, controlName)
      } catch (error) {
        const message = `QRWC: Failed to re-register control ${controlName} in component ${componentName}.`
        if (error instanceof Error) {
          error.message = `${message}\n${error.message}`
          this.logger.error(error)
        } else {
          this.logger.error(new Error(`${message}\n${error}`))
        }
      }
    }
  }

  private addControlToCore = async (
    componentName: string,
    controlName: string
  ): Promise<void> => {
    await this.qrcClient.sendRpc('ChangeGroup.AddComponentControl', {
      Id: this.id,
      Component: {
        Name: componentName,
        Controls: [
          {
            Name: controlName
          }
        ]
      }
    })
  }

  public deregisterControl = (
    control: Control<
      T,
      keyof T['components'],
      keyof T['components'][keyof T['components']]['controls']
    >
  ): void => {
    const key = `${control.component.name}:${control.name}`
    this.register.delete(key)
  }

  public poll = async (): Promise<void> => {
    try {
      const pollResult = await this.qrcClient.sendRpc('ChangeGroup.Poll', {
        Id: this.id
      })
      pollResult.Changes.forEach((change) => {
        const key = `${change.Component}:${change.Name}`
        const entry = this.register.get(key)
        if (entry) {
          entry.onUpdate(change)
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

  public close = (): void => {
    this.stopPolling()
    this.register = new Map<string, IRegisteredControl>()
    this.logger.debug(`ChangeGroup ${this.id} closed.`)
  }
}
