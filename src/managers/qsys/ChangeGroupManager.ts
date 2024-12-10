import { v4 as uuidv4 } from 'uuid'
import { qrcMethods, qrwcEvents } from '../../constants'
import { EventManager, PollingManager } from '..'
import { createJSONRPCMessage } from '../../utils'
import { IChange, IComponent, IComponentChangeGroup, IServerMessage, IMessageAddComponent, IPollingInterval } from '../../index.interface'

export default class ChangeGroupManager {
  private changeGroupUpdateRequests: string[] = []
  private changeGroupId: string = uuidv4()
  private pollingManager: PollingManager | null = null
  private changeGroupComponents: IComponentChangeGroup[] = []
  changeGroupName: string = ''

  constructor(
    changeGroupName: string,
    private send: (data: object) => void,
    private handleControlChanges: (changes: IChange[]) => void,
    private eventManager: EventManager,
    private newPollingRate?: IPollingInterval
  ) {
    // listen for messages
    this.eventManager.on(qrwcEvents.message, (message: IServerMessage) => {
      this.parseMessage(message)
    })
    // assign change group name
    this.changeGroupName = changeGroupName
  }

  // getter for change group id
  get id(): string {
    return this.changeGroupId
  }

  // getter for change group name
  get name(): string {
    return this.changeGroupName
  }

  // setter for change group name
  set name(name: string) {
    this.changeGroupName = name
  }

  // getter for components
  get components(): IComponentChangeGroup[] {
    return this.changeGroupComponents
  }

  // getter for polling service
  get polling(): PollingManager | null {
    return this.pollingManager
  }

  // initialize the polling service
  public initPollingManager(): void {
    // check if polling service is already initialized
    if (this.pollingManager) {
      // emit error
      this.eventManager.emit(
        qrwcEvents.error,
        'Polling service already initialized'
      )
      return
    }

    // create polling service
    this.pollingManager = new PollingManager(
      this.changeGroupId, this.send,
      this.newPollingRate
    )
  }

  // a method for parsing messages
  private parseMessage(message: IServerMessage): void {
    if (message?.id && this.changeGroupUpdateRequests.includes(message?.id)) {
      // if id exists & includes change group request, handle change group response
      this.handleChangeGroupResponse(message as IMessageAddComponent)
    }

    // check message for Changes & if message id is included in componentChangeGroupIds
    if (
      typeof message.result === 'object' && // Add type guard
      'Changes' in message.result && // Add type guard to ensure 'Changes' exists
      this.changeGroupId === message?.result?.Id
    ) {
      // if message has Changes, handle Changes
      /// use handleChangeGroupUpdate method
      this.handleControlChanges(message?.result?.Changes)

    }
  }

  // a method recieves components from control manager and grooms them into IComponentChangeGroup
  public groomComponents(components: IComponent): IComponentChangeGroup[] {
    // create empty array to hold groomed components
    let groomedComponents: IComponentChangeGroup[] = []
    // iterate through components
    Object.keys(components).forEach((componentName: string) => {
      // create component object
      const component: IComponentChangeGroup = {
        Id: this.changeGroupId,
        Component: {
          Name: componentName,
          Controls: Object.keys(components[componentName]).map(
            (controlName: string) => ({
              Name: controlName
            })
          )
        }
      }
      // add component to groomedComponents
      groomedComponents = [...groomedComponents, component]
    })
    // return groomed components
    return groomedComponents
  }

  // a method for creating change groups
  public createChangeGroup(
    components: IComponentChangeGroup[]
  ): void {
    // add components to change group
    this.changeGroupComponents = components

    // iterate through components & add components to change group
    this.changeGroupComponents.forEach((component: IComponentChangeGroup) => {
      // add component to change group
      this.addComponentToChangeGroup(component)
    })
  }

  // a method for adding components to change groups
  public addComponentToChangeGroup(
    component: IComponentChangeGroup
  ): void {
    // create request id
    const requestId = uuidv4()
    // add request id to changeGroupUpdateRequests
    this.changeGroupUpdateRequests = [...this.changeGroupUpdateRequests, requestId]

    // send addComponentControl request
    this.send(
      createJSONRPCMessage(
        qrcMethods.changeGroup.addComponentControl,
        component,
        requestId
      )
    )
  }

  // a method for handling change group responses
  private handleChangeGroupResponse(message: IMessageAddComponent): void {
    // check if change group response is successful
    if (message.result) {
      // remove request id from changeGroupUpdateRequests
      this.changeGroupUpdateRequests = this.changeGroupUpdateRequests.filter(
        (requestId: string) => requestId !== message.id
      )

      // if change group requests is empty, emit change group created event
      if (this.changeGroupUpdateRequests.length === 0) {
        this.eventManager.emit(
          qrwcEvents.componentChangeGroupCreated,
          this.changeGroupName
        )
      }
    } else {
      // emit error
      this.eventManager.emit(
        qrwcEvents.error,
        `Change group - ${this.changeGroupName} - request failed`
      )
    }
  }

  public cleanUp(): void {
    // set changeGroupUpdateRequests to empty array
    this.changeGroupUpdateRequests = []

    // set changeGroupComponents to empty array
    this.changeGroupComponents = []

    // nullify the pollingManager
    if (this.pollingManager) {
      this.pollingManager.cleanUp()
      this.pollingManager = null
    }

    // remove event manager
    this.eventManager = null

    // reset changeGroupName
    this.changeGroupName = ''
  }
}
