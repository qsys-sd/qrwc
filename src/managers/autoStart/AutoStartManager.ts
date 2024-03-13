import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrwcEvents } from "../../constants"
import { createJSONRPCMessage } from "../../utils"
import { IControl, IQSYSControls } from "../../index.interface"
import { WebSocketManager, ControlManager, EventManager } from ".."
import { ControlDecorator } from "../control/ControlDecorator"

export default class AutoStartManager {
  private webSocketManager: WebSocketManager
  private getComponentsId: string = ""
  private componentList: string[] = []
  private getControlIds: string[] = []
  private autoStartChangeGroupId: string = ""
  controlManager: ControlManager
  eventManager: EventManager

  constructor(
    webSocketManager: WebSocketManager,
    controlManager: ControlManager,
    eventManager: EventManager
  ) {
    // main dependencies
    this.webSocketManager = webSocketManager
    this.controlManager = controlManager
    this.eventManager = eventManager

    //event listener for handling websocket messages
    this.eventManager.on(qrwcEvents.message, (message: MessageEvent) => {
      this.parseMessage(message)
    })

    this.eventManager.on(qrwcEvents.componentsRecieved, () => {
      this.getControls()
    })

    this.eventManager.on(qrwcEvents.controlsReceived, () => {
      this.createChangeGroup()
    })

    // listen for change group created event
    this.eventManager.on(
      qrwcEvents.componentChangeGroupCreated,
      (changeGroupId: string) => {
        // check if change group id matches autoStartChangeGroupId
        if (changeGroupId === this.autoStartChangeGroupId) {
          // if change group id matches autoStartChangeGroupId, start polling
          this.webSocketManager.startPolling(this.autoStartChangeGroupId)
        
          // emit event for auto start complete
          this.eventManager.handleEvent(qrwcEvents.autoStartComplete)
        }
      }
    )
  }

  // a method for parsing messages
  private parseMessage(message: any): void {
    // check for getComponents response
    if (message?.id === this.getComponentsId) {
      this.handleComponentGetResponse(message.result)
    }

    // check for getControls response
    if (this.getControlIds.includes(message?.id)) {
      this.handleControlGetResponse(message.result, message.id)
    }
  }

  // a method for starting auto start process
  public start(): void {
    this.getComponents()
  }

  // a method for getting components
  private getComponents(): void {
    // create id for getComponents request
    this.getComponentsId = uuidv4()

    // send getComponents request for all components
    this.webSocketManager.send(
      createJSONRPCMessage(
        qrcMethods.components.getComponents,
        "test",
        this.getComponentsId
      )
    )
  }

  // a method for handling getComponents response
  private handleComponentGetResponse(result: any) {
    // iterate through components in response
    result.forEach((component: any) => {
      // check if component is not already in componentList
      if (!this.componentList.includes(component.Name)) {
        // add component to componentList
        this.componentList = [...this.componentList, component.Name]
      }
    })

    // emit event when all components have been added to componentList
    this.eventManager.handleEvent(qrwcEvents.componentsRecieved)

    // reset getComponentsId
    this.getComponentsId = ""
  }

  // a method for getting controls
  private getControls(): void {
    // iterate through components list
    this.componentList.forEach((component: string) => {
      const id = uuidv4()
      // send getControls request for each component with id
      this.webSocketManager.send(
        createJSONRPCMessage(
          qrcMethods.components.getControls,
          { Name: component },
          id
        )
      )
      // add id to getControlIds
      this.getControlIds = [...this.getControlIds, id]
    })
  }

  // a method for handling getControls response
  private handleControlGetResponse(result: IQSYSControls, id: string) {
    // check if the results has "Name" and "Controls" populated
    if (result?.Name && result?.Controls) {
      // reformat controls into object
      const controlObject = result.Controls.reduce((acc: any, control: IControl) => {
        // decorate control
        const decoratedControl = new ControlDecorator(
          { ...control, Component: result.Name },
          this.controlManager.setComponent.bind(this.controlManager), 
          this.eventManager.handleEvent.bind(this.eventManager)
        )

        return {
          ...acc,
          [control.Name]: decoratedControl
        }
      }
      , {})

      // create component object
      const componentToAdd = {
        [result.Name]: {
          ...controlObject
        }
      }
      
      // add component to control manager
      this.controlManager.addComponent(componentToAdd, result.Name)
    }

    // remove id from getControlIds
    this.getControlIds = this.getControlIds.filter(
      (getId: string) => getId !== id
    )

    // check if getControlIds is empty
    if (this.getControlIds.length === 0) {
      // emit event
      this.eventManager.handleEvent(qrwcEvents.controlsReceived)
    }
  }

  // a method for creating change groups
  private createChangeGroup(): void {
    // create change group id
    const changeGroupId = uuidv4()

    // set autoStartChangeGroupId
    this.autoStartChangeGroupId = changeGroupId

    // create change group from component controls
    this.controlManager.createChangeGroup(this.componentList, changeGroupId)
  }

  // a method for cleaning up the auto start manager
  public cleanUp() {
    // clear componentList
    this.componentList = []

    // clear getControlIds
    this.getControlIds = []

    // clear autoStartChangeGroupId
    this.autoStartChangeGroupId = ""

    // clear getComponentsId
    this.getComponentsId = ""
  }
}
