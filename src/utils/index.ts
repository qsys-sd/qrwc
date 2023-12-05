import { IControl } from '../index.interface';

export const createJSONRPCMessage = (method: string, params: any, id: string | number) => (
  {
    jsonrpc: "2.0",
    method,
    params,
    id
  }
)

export function isValidControl(control: any): control is IControl {
  return control &&
    typeof control.Name === 'string' &&
    typeof control.Component === 'string' &&
    ['string', 'number', 'boolean'].includes(typeof control.Value) &&
    typeof control.String === 'string' &&
    typeof control.Position === 'number' &&
    (control.Type === undefined || typeof control.Type === 'string');
}