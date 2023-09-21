import { EventEmitter } from "events"

export default class EventManager extends EventEmitter {

  constructor() {
    super()
  }

  

  public handleEvent(event: string, ...args: any[]): void {
    this.emit(event, ...args)
  }
}
