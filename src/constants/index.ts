import { IComponentsGetResult, QrwcEvents } from '../index.interface'

export const qrcMethods = {
  components: {
    getComponents: 'Component.GetComponents',
    getControls: 'Component.GetControls',
    set: 'Component.Set'
  },
  changeGroup: {
    poll: 'ChangeGroup.Poll',
    addControl: 'ChangeGroup.AddControl',
    addComponentControl: 'ChangeGroup.AddComponentControl'
  }
}

export const qrwcEvents: QrwcEvents = {
  message: 'message',
  error: 'error',
  disconnected: 'disconnected',
  connected: 'connected',
  webSocketAttached: 'webSocketAttached',
  startComplete: 'startComplete',
  controlsUpdated: 'controlsUpdated',
  controlsReceived: 'controlsReceived',
  componentsReceived: 'componentsReceived',
  changeRequestSuccessful: 'changeRequestSuccessful',
  componentChangeGroupCreated: 'componentChangeGroupCreated'
}

export const qrwcPollReset: number = 30000
export const qrwcMinPollInterval: number = 34
export const qrwcDefaultPollInterval: number = 350

export const qrwcMockComponentGetResult: IComponentsGetResult = {
  Name: 'mock',
  Properties: [],
  ID: 'mock',
  Type: 'mock',
  Controls: null,
  ControlSource: 1
}
