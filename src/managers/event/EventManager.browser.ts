import { IEventEmitter, IQrwcEvents } from '../../index.interface'
import FrontendEventEmitter from './FrontendEvents'

export default class EventManager {
  private emitter: IEventEmitter

  constructor() {
    this.emitter = new FrontendEventEmitter()
  }

  public on<T extends keyof IQrwcEvents, U extends IQrwcEvents[T]>(
    event: T,
    listener: U
  ): void {
    this.emitter.on(event, listener)
  }

  public emit<
    T extends keyof IQrwcEvents,
    U extends Parameters<IQrwcEvents[T]>
  >(event: T, ...args: U): void {
    this.emitter.emit(event, ...args)
  }

  public removeListener(
    event: string,
    listener: (...args: unknown[]) => void
  ): void {
    this.emitter.removeListener(event, listener)
  }

  public removeAllEventListeners(): void {
    this.emitter.removeAllListeners()
  }
}
