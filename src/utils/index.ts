export const createJSONRPCMessage = (method: string, params: any, id: string | number) => (
  {
    jsonrpc: "2.0",
    method,
    params,
    id
  }
)