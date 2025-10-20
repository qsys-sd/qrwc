import type { WebSocket as WsWebSocket } from 'ws'
import type { Control } from './entities/Control.js'
import type { Component } from './entities/Component.js'

/**
 * QRC RPC types
 */

// Generic QRC response
export interface IRpcResponseBody<T> extends Partial<IRpcRequest> {
  result: T
}

export interface IRpcRequest {
  jsonrpc: '2.0'
  method: string
  params: IRpcRequestParams
  id: string
}

// nonspecific QRC req params
export type IRpcRequestParams = Parameters<
  IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]
>[0]

// nonspecific QRC response
export type IRpcResponse = IRpcResponseBody<
  ReturnType<IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]>
>

// helps add strict typing to createJSONRPCMessage
// { <RPC method key>: (arg: <RPC arg type>) => <RPC return type> }
export interface IJsonRpcMessageTypeMap {
  'Component.GetComponents': (
    arg: IComponentGetComponentsRequest
  ) => IComponentGetComponentsResult[]
  'Component.GetControls': (
    arg: IComponentGetControlsRequest
  ) => IComponentGetControlsResult
  'Component.Set': (arg: IComponentSetRequest) => IControlChange[]
  'ChangeGroup.Poll': (arg: IChangeGroupPollRequest) => IChangeGroupPollResult
  'ChangeGroup.AddComponentControl': (
    arg: IChangeGroupAddComponentControlRequest
  ) => IChangeGroupAddComponentControlResult
  StatusGet: () => IStatusGetResult
}

export interface IStatusGetResult {
  Platform: string
  State: 'Active' | 'Idle' | 'Standby'
  DesignName: string
  DesignCode: string
  IsRedundant: boolean
  IsEmulator: boolean
  Status: { Code: number; String: string }
}

/**
 * Component.GetComponents RPC types
 */

// Component returned by Component.GetComponents RPC
export interface IComponentGetComponentsResult {
  Properties: IComponentGetComponentsProperty[]
  ID: string
  Name: string
  Type: string
  Controls: null
  ControlSource: number
}
export interface IComponentGetComponentsProperty {
  Name: string
  Value: string
  PrettyName: string
}

export type IComponentGetComponentsRequest = 'test'

export type IComponentGetComponentsResponse = IRpcResponseBody<
  IComponentGetComponentsResult[]
>

/**
 * Component.GetControls RPC
 */

// Component.GetControls RPC request
export interface IComponentGetControlsRequest {
  Name: string
}

export type IComponentGetControlsResponse =
  IRpcResponseBody<IComponentGetControlsResult>

// Returned by Component.GetControls RPC
export interface IComponentGetControlsResult {
  Name: string
  Controls: IComponentGetControlsControl[]
}

// Control properties returned by Component.GetControls RPC
export interface IComponentGetControlsControl {
  Name: string
  Type: string
  Choices?: string[]
  Value?: number
  String: string
  Direction: string
  Position?: number
  ValueMin?: number
  ValueMax?: number
  StringMin?: string
  StringMax?: string
}

/**
 * ChangeGroup.AddComponentControl types
 */

// ChangeGroup.AddComponentControl RPC request
export interface IChangeGroupAddComponentControlRequest {
  Id: string
  Component: {
    Name: string
    Controls: {
      Name: string
    }[]
  }
}

// ChangeGroup.AddComponentControl RPC result
export interface IChangeGroupAddComponentControlResult {
  Id: string
  Controls: string[]
}

export type IChangeGroupAddComponentControlResponse =
  IRpcResponseBody<IChangeGroupAddComponentControlResult>

/**
 * ChangeGroup.Poll RPC types
 */

// ChangeGroup.Poll RPC request
export interface IChangeGroupPollRequest {
  Id: string
}

// ChangeGroup.Poll RPC result
export interface IChangeGroupPollResult {
  Id: string
  Changes: IControlChange[]
}

export type IChangeGroupPollResponse = IRpcResponseBody<IChangeGroupPollResult>

/**
 * Component.Set RPC types
 */

// Component.Set RPC request
export interface IComponentSetRequest {
  ResponseValues: boolean
  Name: string
  Controls: ({
    Name: string
  } & IControlUpdate)[]
}

export type IComponentSetResponse = IRpcResponseBody<IControlChange[]>

// Sent from QRC whenever a control changes (due to ChangeGroup.Poll or due to Component.Set)
export interface IControlChange {
  Component: string
  Name: string
  String: string
  Value: number
  Position: number
  Choices?: string[]
  Color?: string
  Indeterminate?: boolean
  Invisible?: boolean
  Disabled?: boolean
  Legend?: string
  CssClass?: string
  Strings?: string[]
  Values?: number[]
}

export interface IControlUpdate {
  String?: string
  Value?: string | number
  Position?: number
  Strings?: string[]
  Values?: number[]
  Bool?: boolean
}

/**
 * EventEmitter event types
 * These are used to define the listeners for each EventEmitter
 * based on the supplied event
 */

// Generic type that allows EventEmitter to define its callback type based on the event type
export interface IEventEmitter<T> {
  on<U extends keyof T>(event: U, listener: T[U]): void
  emit<U extends keyof T>(
    event: U,
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    ...args: T[U] extends (...args: any[]) => void ? Parameters<T[U]> : never
  ): void
  removeListener<U extends keyof T>(event: U, listener: T[U]): void
  removeAllListeners(): void
}

export interface IComponentEvents {
  update: (control: Control, state: IControlState) => void
  error: (error: Error) => void
}

export interface IControlEvents {
  update: (state: IControlState) => void
  error: (error: Error) => void
}

export interface IQrwcEvents {
  update: (component: Component, control: Control, state: IControlState) => void
  error: (event: Error) => void
  disconnected: (reason: string) => void
}

export interface IWebSocketManagerEvents {
  message: (message: IRpcResponse) => void
  error: (error: Error) => void
  disconnected: (reason: string) => void
}

/**
 * Miscellaneous Types
 * Not sure where to put these :)
 */

// defines state property for a Component object
export type IComponentState = Readonly<IComponentGetComponentsResult>

// defines state property on a Control object
export type IControlState = Readonly<
  IComponentGetControlsControl & Partial<IControlChange> & { Bool: boolean }
>

// Unifies ws WebSocket type (node) and the browser built-in WebSocket type
export type IWebSocket = WebSocket | WsWebSocket

// Qrwc start options
export interface IStartOptions {
  socket: IWebSocket
  pollingInterval?: number
  componentFilter?: (componentState: IComponentState) => boolean
  timeout?: number
  logger?: Partial<ILogger>
}

export type ILogger = Pick<
  typeof console,
  'trace' | 'debug' | 'info' | 'warn' | 'error'
>
