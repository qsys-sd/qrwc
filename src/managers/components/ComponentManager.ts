import { v4 as uuidv4 } from 'uuid'
import { IComponentsGetResult, IServerMessage } from '../../index.interface'
import { qrcMethods, qrwcEvents } from '../../constants'
import { JSONRPCMessage, createJSONRPCMessage } from '../../utils'

export default class ComponentManager {
  public componentList: IComponentsGetResult[] = []
  public componentNames: string[] = []
  private getComponentsId: string = ''
  private websocketSend: (message: JSONRPCMessage) => void

  constructor(
    private onMessage: (event: string, listener: (message: IServerMessage) => void) => void,
    private emit: (event: string, ...args: unknown[]) => void
  ) {
    //event listener for handling websocket messages
    this.onMessage(qrwcEvents.message, (message: IServerMessage) => {
      this.parseMessage(message)
    })

    this.onMessage(qrwcEvents.webSocketAttached, () => {
      this.getComponents()
    })
  }

  // get component names
  public getComponentNames(): string[] {
    return this.componentNames
  }

  // set websocket send method
  public setWebSocketSend(send: (message: JSONRPCMessage) => void): void {
    this.websocketSend = send
  }

  private setComponentNames(): void {
    const names = this.componentList.map((component) => component.Name)
    this.componentNames = names
  }

  // a method for parsing messages
  private parseMessage(message: IServerMessage): void {
    // check for getComponents response
    if (message?.id === this.getComponentsId) {
      this.handleComponentGetResponse(message.result as IComponentsGetResult[])
    }
  }

  // a method for getting components
  public getComponents(): void {
    // create id for getComponents request
    this.getComponentsId = uuidv4()

    // send getComponents request for all components
    this.websocketSend(
      createJSONRPCMessage(
        qrcMethods.components.getComponents,
        'test',
        this.getComponentsId
      )
    )
  }

  // // a method for handling getComponents response
  private handleComponentGetResponse(result: IComponentsGetResult[]): void {
    this.componentList = result

    // set component names
    this.setComponentNames()

    // emit event when all components have been added to componentList
    this.emit(qrwcEvents.componentsReceived, this.componentList)
  }
}
