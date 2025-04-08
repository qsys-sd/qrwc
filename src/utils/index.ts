import { IChange, IComponentChangeGroup, IRequestChanges, IRequestControls, IRequestPoll } from '../index.interface'

export type JSONRPCMessage = ReturnType<typeof createJSONRPCMessage>

interface IJsonRpcMessage {
  'Component.GetComponents': 'test';
  'Component.GetControls': IRequestControls;
  'Component.Set': IRequestChanges;
  "ChangeGroup.Poll": IRequestPoll;
  'ChangeGroup.AddComponentControl': IComponentChangeGroup
}

export const createJSONRPCMessage = <T extends keyof IJsonRpcMessage, U extends IJsonRpcMessage[T]>(
  method: T,
  params: U,
  id: string | number
) => ({
  jsonrpc: "2.0",
  method,
  params,
  id,
} as const);

export function isValidControlChange(control: IChange): control is IChange {
  return control &&
    typeof control.Name === 'string' &&
    typeof control.Component === 'string' &&
    typeof control.Value === 'number' &&
    typeof control.String === 'string' &&
    typeof control.Position === 'number'
}