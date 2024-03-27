import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrwcEvents } from "../../constants"
import { WsDependencySetter, WebSocketManager, EventManager, ControlManager } from ".."
import { createJSONRPCMessage } from "../../utils"

export default class ChangeGroupManager extends WsDependencySetter {
    private changeGroupRequests: string[] = []
    private requestChangeGroupId: string = ""
    private changeGroups: { [changeGroupId: string]: string[] } = {}

    constructor(
        private eventManager: EventManager,
        private controlManager: ControlManager
        ){
        super()
        this.eventManager.on(qrwcEvents.message, (message: MessageEvent) => {
            this.parseMessage(message)
        })
    }

    // a method for parsing messages
    private parseMessage(message: any): void {
        if (message?.id && this.changeGroupRequests.includes(message?.id)) {
            // if id exists & includes change group request, handle change group response
            this.handleChangeGroupResponse(message)
        }

        // get list of existing change group ids
        const existingChangeGroupIds = Object.keys(this.changeGroups)
        // check message for Changes & if message id is included in componentChangeGroupIds
        if (
            message?.result?.Changes &&
            existingChangeGroupIds.includes(message?.result?.Id)
        ) {
            // if message has Changes, handle Changes
            /// use handleChangeGroupUpdate method
            this.controlManager.handleControlChanges(message?.result?.Changes)
        }
    }

    // a setter for websocketManager
    public setWebSocketManager(websocketManager: WebSocketManager): void {
        // check if websocketManager is defined
        if (this.websocketManager) {
            // emit error
            this.eventManager.handleEvent(
                qrwcEvents.error,
                "Websocket manager already attached"
            )
            return
        }

        this.websocketManager = websocketManager
    }

    // a method for creating change groups
    public createChangeGroup(
        componentNames: string[],
        changeGroupId: string
    ): void {
        // get list of existing change group ids
        const existingChangeGroupIds = Object.keys(this.changeGroups)
        // check for existing change group id
        if (existingChangeGroupIds.includes(changeGroupId)) {
            // if change group id exists, emit error
            this.eventManager.handleEvent(
                qrwcEvents.error,
                "Change group id already exists"
            )
            return
        }

        // save change group id to requestChangeGroupId
        this.requestChangeGroupId = changeGroupId

        // add change group to list of change groups
        this.changeGroups = {
            ...this.changeGroups,
            [changeGroupId]: componentNames
        }

        // iterate through component names
        componentNames.forEach((componentName: string) => {
            // add component to change group
            this.addComponentToChangeGroup(componentName, changeGroupId)
        })
    }

    // a method for adding components to change groups
    private addComponentToChangeGroup(
        componentName: string,
        changeGroupId: string
    ): void {
        // create request id
        const requestId = uuidv4()
        // add request id to changeGroupRequests
        this.changeGroupRequests = [...this.changeGroupRequests, requestId]

        // get control names by component
        const controlNames = this.controlManager.getControlNamesByComponent(componentName)

        // create & format component for message
        const newComponent = {
            Id: changeGroupId,
            Component: {
                Name: componentName,
                Controls: controlNames
            }
        }

        // send addComponentControl request
        this.websocketManager.send(
            createJSONRPCMessage(
                qrcMethods.changeGroup.addComponentControl,
                newComponent,
                requestId
            )
        )
    }

    // a method for handling change group responses
    private handleChangeGroupResponse(message: any): void {
        // check if change group response is successful
        if (message.result) {
            // remove request id from changeGroupRequests
            this.changeGroupRequests = this.changeGroupRequests.filter(
                (requestId: string) => requestId !== message.id
            )

            // if change group requests is empty, emit change group created event
            if (this.changeGroupRequests.length === 0) {
                this.eventManager.handleEvent(
                    qrwcEvents.componentChangeGroupCreated,
                    this.requestChangeGroupId
                )

                // reset requestChangeGroupId
                this.requestChangeGroupId = ""
            }
        } else {
            // emit error
            this.eventManager.handleEvent(
                qrwcEvents.error,
                "Change group request failed"
            )
        }
    }

    // a method for initiating clean up for ChangeGroupManager
    public cleanUp(): void {
        // set eventManager to null
        this.eventManager = null

        // set controlManager to null
        this.controlManager = null

        // set changeGroupRequests to empty array
        this.changeGroupRequests = []

        // set requestChangeGroupId to empty string
        this.requestChangeGroupId = ""

        // set changeGroups to empty object
        this.changeGroups = {}
    }
}