import { v4 as uuidv4 } from 'uuid'
import { qrcMethods, qrwcEvents } from '../../constants'
import { createJSONRPCMessage, JSONRPCMessage } from '../../utils'
import { IControlGet, IControlGetResult, IServerMessage } from '../../index.interface'
import { ControlManager, EventManager } from '..'
import { ChangeGroupService } from '../../services'
import { ControlDecorator } from '../components/ControlDecorator'

export default class AutoStartManager {
  private getControlIds: string[] = []
  private autoStartChangeGroupId: string = 'AutoStartChangeGroup'
  private changeGroupService: ChangeGroupService | null = null
  private didAutoStart: boolean = false

  constructor(
    private websocketSend: (message: JSONRPCMessage) => void,
    private controlManager: ControlManager,
    private eventManager: EventManager,
    private getComponentNames: () => string[]
  ) {
    // main dependencies
    this.controlManager = controlManager
    this.eventManager = eventManager

    //event listener for handling websocket messages
    this.eventManager.on(qrwcEvents.message, (message: IServerMessage) => {
      this.parseMessage(message)
    })

    this.eventManager.on(qrwcEvents.componentsReceived, () => {
      if (this.didAutoStart) {
        const componentNames = this.getComponentNames()
        this.getControls(componentNames)
      }
    })

    this.eventManager.on(qrwcEvents.controlsReceived, () => {
      this.createAutoStartChangeGroup()
    })

    // listen for change group created event
    this.eventManager.on(
      qrwcEvents.componentChangeGroupCreated,
      (changeGroupId: string) => {
        // check if change group id matches autoStartChangeGroupId
        if (changeGroupId === this.autoStartChangeGroupId && this.changeGroupService) {
          // create auto start change group polling service
          this.createAutoStartChangePollingService()
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

  // a method for starting auto start process
  public start(): void {
    this.didAutoStart = true
  }

  // a method for getting controls
  private getControls(componentNames: string[]): void {
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
      const controlObject = result.Controls.reduce((acc: { [key: string]: ControlDecorator }, control: IControlGet) => {
        // decorate control
        const decoratedControl = new ControlDecorator(
          { ...control, Component: result.Name },
          this.controlManager.setComponent.bind(this.controlManager),
          this.eventManager.emit.bind(this.eventManager)
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
      this.eventManager.emit(qrwcEvents.controlsReceived)
    }
  }

  // a method for creating change groups
  private createAutoStartChangeGroup(): void {
    // create change group service
    this.changeGroupService = new ChangeGroupService(
      this.autoStartChangeGroupId,
      this.websocketSend,
      this.controlManager.handleControlChanges.bind(this.controlManager),
      this.eventManager
    )

    // groom components for change group
    const groomedComponents = this.changeGroupService.groomComponents(this.controlManager.components)

    // create change group
    this.changeGroupService.createChangeGroup(groomedComponents)
  }

  // a method for creating auto start change group polling service
  private createAutoStartChangePollingService(): void {
    // init polling service
    this.changeGroupService.initPollingService()

    const { polling } = this.changeGroupService

    // check if polling service is initialized
    if (polling) {
      // start polling service
      this.changeGroupService.polling.start()
    }

    // emit event for auto start complete
    this.eventManager.emit(qrwcEvents.autoStartComplete)
  }

  // a method for cleaning up the auto start manager
  public cleanUp() {
    // clear getControlIds
    this.getControlIds = []

    // clear autoStartChangeGroupId
    this.autoStartChangeGroupId = ''

    // stop ongoing polling and cleanup changeGroupService
    if (this.changeGroupService) {
      this.changeGroupService.cleanUp()

      this.changeGroupService = null
    }

    // set controlManager to null
    this.controlManager = null

    // set eventManager to null
    this.eventManager = null
  }
}
