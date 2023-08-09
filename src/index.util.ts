export const createJSONRPCMessage = (method: string, params: any, id: string | number) => (
  {
    jsonrpc: "2.0",
    method,
    params,
    id
  }
)

export const qrcMethods = {
  components: {
    getComponents: "Component.GetComponents",
    getControls: "Component.GetControls",
  },
  changeGroup: {
    poll: "ChangeGroup.Poll",
    addControl: "ChangeGroup.AddControl",
  }
}