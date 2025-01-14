import { v4 as uuidv4 } from 'uuid'
import { qrcMethods, qrwcEvents } from '../../constants'
import { createJSONRPCMessage, JSONRPCMessage } from '../../utils'
import { IControlGet, IControlGetResult, IServerMessage, IComponentFilter, IPollingInterval, IComponent } from '../../index.interface'
import { ControlManager, EventManager, ChangeGroupManager, ComponentManager } from '..'

export default class StartManager {
  private getControlIds: string[] = []
  private startChangeGroupId: string = 'StartChangeGroup'
  private changeGroupManager: ChangeGroupManager | null = null
  componentFilter: IComponentFilter | null = null

  constructor(
    private websocketSend: (message: JSONRPCMessage) => void,
    private componentManager: ComponentManager,
    private controlManager: ControlManager,
    private eventManager: EventManager,
    private newPollingRate?: IPollingInterval
  ) {
    // main dependencies
    this.controlManager = controlManager
    this.eventManager = eventManager

    //event listener for handling websocket messages
    this.eventManager.on(qrwcEvents.message, (message: IServerMessage) => {
      this.parseMessage(message)
    })

    this.eventManager.on(qrwcEvents.componentsReceived, (components: { [componentName: string]: IComponent}) => {
      this.getControls(components)
    })

    this.eventManager.on(qrwcEvents.controlsReceived, () => {
      this.createStartChangeGroup()
    })

    // listen for change group created event
    this.eventManager.on(
      qrwcEvents.componentChangeGroupCreated,
      (changeGroupId: string) => {
        // check if change group id matches startChangeGroupId
        if (changeGroupId === this.startChangeGroupId && this.changeGroupManager) {
          // create start change group polling service
          this.createStartChangePollingManager()
        }
      }
    )
  }

  // a method for parsing messages
  private parseMessage(message: IServerMessage): void {
    // check for getControls response
    if (this.getControlIds.includes(message?.id)) {
      this.handleControlGetResponse(message.result as IControlGetResult, message.id)
    }
  }

  // a method for kicking off the getComponents process
  public start(): void {
    this.componentManager.getComponents()
  }

  // a method for getting controls
  private getControls(components: { [componentName: string]: IComponent }): void {
    // get component names
    const componentNames = Object.keys(components)

    // set components in control manager
    this.controlManager.components = components

    // iterate through components list
    componentNames.forEach((component: string) => {
      const id = uuidv4()
      // send getControls request for each component with id
      this.websocketSend(
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
  private handleControlGetResponse(result: IControlGetResult, id: string) {
    // check if the results has "Name" and "Controls" populated
    if (result?.Name && result?.Controls) {
      // reformat controls into object

      result.Controls.forEach((control: IControlGet) => {
        // decorate control
        const decoratedControl = this.controlManager.decorateControl({...control, Component: result.Name})
        // set control
        this.controlManager.updateControls(decoratedControl)
      })
    }

    // remove id from getControlIds
    this.getControlIds = this.getControlIds.filter(
      (getId: string) => getId !== id
    )

    // check if getControlIds is empty
    if (this.getControlIds.length === 0) {
      // emit event
      this.eventManager.emit(qrwcEvents.controlsReceived)
    }
  }

  // a method for creating change groups
  private createStartChangeGroup(): void {
    // create change group service
    this.changeGroupManager = new ChangeGroupManager(
      this.startChangeGroupId,
      this.websocketSend,
      this.controlManager.handleControlChanges.bind(this.controlManager),
      this.eventManager,
      this.newPollingRate
    )

    // groom components for change group
    const groomedComponents = this.changeGroupManager.groomComponents(this.controlManager.components)

    // create change group
    this.changeGroupManager.createChangeGroup(groomedComponents)
  }

  // a method for creating start change group polling service
  private createStartChangePollingManager(): void {
    // init polling service
    this.changeGroupManager.initPollingManager()

    const { polling } = this.changeGroupManager

    // check if polling service is initialized
    if (polling) {
      // start polling service
      this.changeGroupManager.polling.start()
    }

    // emit event for start complete
    this.eventManager.emit(qrwcEvents.startComplete)
  }

  // a method for cleaning up the start manager
  public cleanUp() {
    // clear getControlIds
    this.getControlIds = []

    // clear startChangeGroupId
    this.startChangeGroupId = ''

    // stop ongoing polling and cleanup changeGroupManager
    if (this.changeGroupManager) {
      this.changeGroupManager.cleanUp()

      this.changeGroupManager = null
    }

    // set controlManager to null
    this.controlManager = null

    // set eventManager to null
    this.eventManager = null
  }
}
