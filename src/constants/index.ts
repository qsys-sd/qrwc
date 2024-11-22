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

export const qrwcEvents = {
  message: 'message',
  error: 'error',
  disconnected: 'disconnected',
  connected: 'connected',
  webSocketAttached: 'webSocketAttached',
  autoStartComplete: 'autoStartComplete',
  controlsUpdated: 'controlsUpdated',
  controlsReceived: 'controlsReceived',
  componentsRecieved: 'componentsReceived',
  changeRequestSuccessful: 'changeRequestSuccessful',
  componentChangeGroupCreated: 'componentChangeGroupCreated'
}

export const qrwcPollReset: number = 30000
