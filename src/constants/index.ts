import { QrwcEvents } from '../index.interface'

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
