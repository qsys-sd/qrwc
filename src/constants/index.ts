export const qrcMethods = {
  components: {
    getComponents: "Component.GetComponents",
    getControls: "Component.GetControls",
    set: "Component.Set",
  },
  changeGroup: {
    poll: "ChangeGroup.Poll",
    addControl: "ChangeGroup.AddControl",
    addComponentControl: "ChangeGroup.AddComponentControl",
  }
}

export const qrccEvents = {
  message: "message",
  error: "error",
  disconnected: "disconnected",
  connected: "connected",
  controlUpdated: "controlUpdated",
  constrolAdded: "controlAdded",
  controlsRecieved: "controlsReceived",
  componentsRecieved: "componentsReceived",
  componentUpdated: "componentUpdated",
  componentChangeGroupCreated: "componentChangeGroupCreated"
}