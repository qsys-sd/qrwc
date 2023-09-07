import { IChangeGroup, IControl, IQrccOptions } from "./index.interface"
import { v4 as uuidv4 } from 'uuid'
import { createJSONRPCMessage, qrcMethods } from "./index.util"
import { EventEmitter } from 'events'

export default class Qrcc extends EventEmitter {
  private url: string = ""
  private websocket: WebSocket | null = null
  private socketPollId: number = 1
  private componentsGetId: string = ""
  private controlGetIds: string[] = []
  readonly pollInterval: number = 3000
  readonly qrccEvents: { [key: string]: string } = {
    controlUpdated: "controlUpdated",
    constrolAdded: "controlAdded",
    controlsRecieved: "controlsReceived",
  }
  changeGroups: IChangeGroup[] = []
  componentList: string[] = []
  controls: IControl[]
  autoStart: boolean = false

  constructor(options: IQrccOptions) {
    super()
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

  // a function that takes a results object and returns an array of controls
  private getControlsFromMessage = (results: any) => {
    // check if results is an array or a single object and convert to array if needed
    if(results.Controls) {
      return results.Controls
    } else if (results) {
      return [results]
    } else {
      // return empty array if results is null
      return []
    }
  }

  // a function that take an array of controls and returns an array of controls that do not exist in this.controls
  private filterExistingControls(controls: any[]) {
    return controls.filter((control: any) => !this.controls.find((c: any) => c.Name === control.Name))
  }

  // a function that takes an array of controls and returns an array of controls that do exist in this.controls
  private filterNonExistingControls(controls: any[]) {
    return controls.filter((control: any) => this.controls.find((c: any) => c.Name === control.Name))
  }

  // a function that takes a control and replaces the existing control with the same name
  private replaceExistingControl(control: any) {
    // find existing control
    const existingControl = this.controls.find((c: any) => c.Name === control.Name)
    // check if existing control exists
    if (existingControl) {
      // remove existing control from this.controls
      this.controls = this.controls.filter((c: any) => c.Name !== control.Name)
      // add updated control to this.controls
      this.controls = [...this.controls, control]
      // emit event
      this.handleEvent(this.qrccEvents.controlUpdated, control, this.controls)
    } else {
      // emit warning
      console.warn("Existing control not found.")
    }
  }

  // a function that takes a new control and adds it to this.controls and emits an event
  private addNewControl(control: any) {
    // add new control to this.controls
    this.controls = [...this.controls, control]
    // emit event
    this.handleEvent(this.qrccEvents.constrolAdded, control, this.controls)
  } 

  // a function that takes data from a controlGet response and adds new controls to this.controls and replaces existing controls in this.controls
  private handleControlGetResponse(data: any) {
    // check if data.result is an array or a single object and convert to array if needed
    const controls = this.getControlsFromMessage(data.result)
    // filter out controls that already exist in this.controls
    const newControls = this.filterExistingControls(controls)
    // filter out controls that do not exist in this.controls
    const existingControls = this.filterNonExistingControls(controls)

    //check if new controls array is not empty
    if (newControls.length > 0) {
      // add new controls to this.controls
      newControls.forEach((control: any) => {
        this.addNewControl(control)
      })
    }

    // check if existing controls array is not empty
    if (existingControls.length > 0) {
      // replace existing controls in this.controls
      existingControls.forEach((control: any) => {
        this.replaceExistingControl(control)
      })
    }

    //check if both new and existing controls arrays are empty
    if (newControls.length === 0 && existingControls.length === 0) {
      // emit warning
      console.warn("No new or existing controls found in response.")
    }
    
    // remove id from controlGetIds
    this.controlGetIds = this.controlGetIds.filter((id: string) => id !== data.id)

    // check if controlGetIds is empty
    if (this.controlGetIds.length === 0) {
      // emit event
      this.handleEvent(this.qrccEvents.controlsRecieved, this.controls)
    }
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

  private handleEvent(eventName: string, ...args: any[]) {
    this.emit(eventName, ...args);
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
