import { IChange, IComponentChangeGroup, IRequestChanges, IRequestControls, IRequestPoll } from '../index.interface';

export const createJSONRPCMessage = (method: string, params: "test" | IRequestChanges | IRequestControls | IComponentChangeGroup | IRequestPoll, id: string | number) => (
  {
    jsonrpc: "2.0",
    method,
    params,
    id
  }
)

export function isValidControlChange(control: IChange): control is IChange {
  return control &&
    typeof control.Name === 'string' &&
    typeof control.Component === 'string' &&
    typeof control.Value === 'number' &&
    typeof control.String === 'string' &&
    typeof control.Position === 'number';
}