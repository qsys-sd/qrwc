import { IChangeGroup, IControl, IQrccOptions } from "./index.interface"
import { v4 as uuidv4 } from 'uuid';
import { createJSONRPCMessage, qrcMethods } from "./index.util";

export default class Qrcc {
  private url: string = ""
  private websocket: WebSocket | null = null
  private socketPollId: number = 1
  private componentsGetId: string = ""
  private controlGetIds: string[] = []
  readonly pollInterval: number = 3000
  changeGroups: IChangeGroup[] = []
  componentList: string[] = []
  controls: IControl[]
  autoStart: boolean = false

  constructor(options: IQrccOptions) {
    this.url = options.url
    this.pollInterval = options.pollInterval
    this.autoStart = options.autoStart
    this.controls = options.controls || []
    this.checkAutoStart(options.autoStart)
  }

  // private methods for internal use

  private isOpen() {
    return this.websocket.readyState === WebSocket.OPEN
  }

  private setupWebSocket(): void {
    this.websocket = new WebSocket(this.url)
    this.websocket.onopen = this.onOpen.bind(this)
    this.websocket.onmessage = this.onMessage.bind(this)
    this.websocket.onerror = this.onError.bind(this)
    this.websocket.onclose = this.onClose.bind(this)
  }

  private onOpen(): void {
    console.log("WebSocket connection established.")
    if (this.autoStart) {
      this.getComponents()
    } else {
      console.warn("AutoStart is disabled. You must sumbit your own controls.")
    }
  }

  private onMessage(event: MessageEvent): void {
    const data = JSON.parse(event.data)
    console.log("Received message:", data)

    if (data.id === this.componentsGetId) {
      this.handleComponentGetResponse(data)
    }
    if (this.controlGetIds.includes(data.id)) {
      this.handleControlGetResponse(data)
    }
  }

  private handleComponentGetResponse(data: any) {
    data.result.forEach((component: any) => {
      this.componentList = [...this.componentList, component.Name]
    })
    this.getControls()
    this.componentsGetId = ""
  }

  private handleControlGetResponse(data: any) {
    console.log("handleControlGetResponse", data)
    if (data.result.Controls) {
      this.controls = [...this.controls, ...data.result.Controls]
    } else if (data.result) {
      this.controls = [...this.controls, data.result]
    } else {
      console.error("No controls found in response.")
    }
    
    this.controlGetIds = this.controlGetIds.filter((id: string) => id !== data.id)
  }

  private onError(event: Event): void {
    console.error("WebSocket error:", event)
  }

  private onClose(event: CloseEvent): void {
    console.log("WebSocket connection closed:", event.code, event.reason)
    this.websocket = null
  }

  private checkAutoStart(autoStart: boolean) {
    if (autoStart) {
      this.connect()
    }
  }

  private getComponents(): void {
    this.componentsGetId = uuidv4()
    this.send(
      createJSONRPCMessage(qrcMethods.components.getComponents, "test", this.componentsGetId)
    )
  }

  private getControls(): void {
    this.componentList.forEach((component: string) => {
      const id = uuidv4()
      this.send(
        createJSONRPCMessage(qrcMethods.components.getControls, {Name: component}, id)
      )
      this.controlGetIds = [...this.controlGetIds, id]
    })
  }

  private poll(changeGroupId: string): void {
    this.send(
      createJSONRPCMessage(qrcMethods.changeGroup.poll, {Id: changeGroupId}, this.socketPollId)
    )
    this.socketPollId++
  }

  // public methods that can call private handlers

  public startPolling(changeGroupId: string): void {
    setInterval(() => this.poll(changeGroupId), this.pollInterval)
  }

  public createChangeGroup(Id: string, Controls: string[]): void {
    this.changeGroups = [...this.changeGroups, {Id, Controls}]
    this.send(
      createJSONRPCMessage(qrcMethods.changeGroup.addControl, {Id, Controls}, uuidv4())
    )
  }

  public getReadyState(): number | string {
    if (this.websocket) {
      return this.websocket.readyState
    } else {
      return "NOT_INITIALIZED"
    }
  }

  public connect(): void {
    if (this.websocket === null && this.url !== "") {
      this.setupWebSocket()
    } else {
      console.warn("WebSocket connection is already established.")
    }
  }

  public send(data: object): void {
    if (this.isOpen()) {
      this.websocket.send(JSON.stringify(data))
    } else {
      console.error("WebSocket is not open or not initialized.")
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.isOpen) {
      this.websocket.close(code, reason)
    } else {
      console.warn("WebSocket is not open or not initialized.")
    }
  }
}
