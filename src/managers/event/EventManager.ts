import { EventEmitter } from "events"

export default class EventManager extends EventEmitter {

  constructor() {
    super()
  }

  public handleEvent(event: string, ...args: any[]): void {
    this.emit(event, ...args)
  }

  public removeEventListener(event: string, listener: (...args: any[]) => void): void {
    this.removeListener(event, listener);
  }

  // an async method for removing all listeners using super(EventEmitter) and returning a promise when complete
  public async removeAllEventListeners(): Promise<void> {
    // remove all listeners using super
    super.removeAllListeners()

    // return promise
    return Promise.resolve()
  }
}
