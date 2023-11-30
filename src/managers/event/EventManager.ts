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

  // a method for removing all listeners using super(EventEmitter) and returning a promise when complete
  public removeAllEventListeners() {
    // remove all listeners using super
    super.removeAllListeners()
  }
}
