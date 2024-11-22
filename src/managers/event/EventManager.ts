import { IEventEmitter } from './IEventEmitter'
import FrontendEventEmitter from './FrontendEvents'

const isInBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

export default class EventManager {
  private emitter: IEventEmitter

  constructor() {
    this.initializeEmitter()
  }

  private async initializeEmitter() {
    if (isInBrowser) {
      this.emitter = new FrontendEventEmitter()
    } else {
      const { EventEmitter } = await import('events')
      this.emitter = new EventEmitter() as IEventEmitter
    }
  }

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener)
  }

  public emit(event: string, ...args: unknown[]): void {
    this.emitter.emit(event, ...args)
  }

  public removeListener(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.removeListener(event, listener)
  }

  public removeAllEventListeners(): void {
    this.emitter.removeAllListeners()
  }
}
