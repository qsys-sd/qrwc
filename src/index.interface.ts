import type { WebSocket as WsWebSocket } from 'ws'
import type { Control } from './entities/Control.js'
import type { Component } from './entities/Component.js'

/**
 * QRC RPC types
 */

interface IRpcMeta {
  jsonrpc: '2.0'
  id: string
}

// Generic QRC response
interface IRpcResponseBody<T> extends IRpcMeta {
  result: T
}

export interface IRpcError extends IRpcMeta {
  error: {
    code: number
    message: string
  }
}

export interface IRpcRequest extends IRpcMeta {
  apiKey?: string
  method: string
  params: IRpcRequestParams
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
  Properties: Readonly<IComponentGetComponentsProperty[]>
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

export type IComponentGetComponentsRequest = 'test' // i don't know if this was a mistake but i do know that it works

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
  String?: string
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
  Positions?: number[]
}

export interface IControlUpdate {
  String?: string
  Value?: string | number
  Position?: number
  Strings?: string[]
  Values?: number[]
  Positions?: number[]
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

export interface IComponentEvents<
  T extends IQrwcExpandedGenericParameter,
  U extends keyof T['components']
> {
  update: (
    control: Control<T, U, keyof T['components'][U]['controls']>,
    state: Control<T, U, keyof T['components'][U]['controls']>['state']
  ) => void
  error: (error: Error) => void
}

export interface IControlEvents<
  T extends IQrwcExpandedGenericParameter,
  U extends keyof T['components'],
  V extends
    keyof T['components'][U]['controls'] = keyof T['components'][U]['controls']
> {
  update: (state: Control<T, U, V>['state']) => void
  error: (error: Error) => void
}

export interface IQrwcEvents<T extends IQrwcExpandedGenericParameter> {
  update: (
    component: Component<T, keyof T['components']>,
    control: Control<
      T,
      keyof T['components'],
      keyof T['components'][keyof T['components']]['controls']
    >,
    state: Control<
      T,
      keyof T['components'],
      keyof T['components'][keyof T['components']]['controls']
    >['state']
  ) => void
  error: (event: Error) => void
  disconnected: (reason: string) => void
  reconnected: () => void
}

export interface IConnectionEvents {
  message: (raw: string) => void
  error: (error: Error) => void
  disconnected: (reason: string) => void
  reconnected: () => void
  closed: (reason: string) => void
}

export interface IQrcClientEvents {
  message: (message: unknown) => void
  error: (error: Error) => void
  disconnected: (reason: string) => void
  reconnected: () => void
  closed: (reason: string) => void
}

export interface IConnection extends IEventEmitter<IConnectionEvents> {
  send: (data: string) => void
  close: () => void
}

/**
 * Miscellaneous Types
 * Not sure where to put these :)
 */

// Forces the editor to display a mapped/utility type (e.g. Pick<...>) as its
// resolved property shape on hover instead of the alias name.
export type Prettify<T> = { [K in keyof T]: T[K] } & {}

// defines state property for a Component object
export type IComponentState<
  T extends
    IComponentGenericParameter['controls'] = IComponentGenericParameter['controls']
> = Readonly<
  Omit<IComponentGetComponentsResult, 'Controls'> & {
    Controls: Readonly<T[keyof T]['state'][]>
  }
>

// defines state property on a Control object
export type IControlState = Readonly<
  IComponentGetControlsControl &
    Partial<IControlChange> & {
      Bool: boolean
    }
>

// Unifies ws WebSocket type (node) and the browser built-in WebSocket type
export type IWebSocket = WebSocket | WsWebSocket

export interface IReconnectOptions {
  maxAttempts?: number
  delay?: number
  maxDelay?: number
  backoffFactor?: number
}

interface IStartOptionsBase {
  // Only required when the core has access control (authentication) enabled.
  apiKey?: string
  pollingInterval?: number
  componentFilter?: (componentState: IComponentGetComponentsResult) => boolean
  timeout?: number
  logger?: Partial<ILogger>
}

export interface IUnmanagedStartOptions extends IStartOptionsBase {
  socket: IWebSocket
  host?: never
}

export interface IManagedStartOptions extends IStartOptionsBase {
  host: string
  // Typed `unknown` to avoid a runtime undici/ws dependency; forwarded to the
  // native WebSocket so a self-signed core cert can be trusted (Node only).
  dispatcher?: unknown
  reconnect?: IReconnectOptions
  socket?: never // The `never` pair keeps the two modes mutually exclusive.
}

export type IStartOptions = IUnmanagedStartOptions | IManagedStartOptions

export type ILogger = Pick<
  typeof console,
  'trace' | 'debug' | 'info' | 'warn' | 'error'
>

export interface IControlGenericParameter {
  state: IControlState
}

export interface IComponentGenericParameter {
  controls: Record<string, IControlGenericParameter>
}

export interface IQrwcExpandedGenericParameter {
  components: Record<string, IComponentGenericParameter>
}

/**
 * The simplified generic parameter format: a map of component name to a union
 * of that component's control names.
 * e.g. { Gain: 'gain' | 'mute', Gain_1: 'gain' }
 */
export type IQrwcSimpleGenericParameter = Record<string, string>

/**
 * Converts the simplified {@link IQrwcSimpleGenericParameter} format into the detailed
 * {@link IQrwcExpandedGenericParameter} format, giving every control the generic
 * IControlState.
 */
export type ISimpleToExpanded<T extends IQrwcSimpleGenericParameter> = {
  components: {
    [ComponentName in keyof T]: {
      controls: {
        [ControlName in Extract<T[ComponentName], string>]: {
          state: IControlState
        }
      }
    }
  }
}

/**
 * Accepts either the detailed {@link IQrwcExpandedGenericParameter} format or the
 * simplified {@link IQrwcSimpleGenericParameter} format, and resolves to the detailed
 * format used internally. The detailed format is checked first because it is
 * the more specific of the two shapes.
 */
export type INormalizedQrwcParameter<T> =
  T extends IQrwcExpandedGenericParameter
    ? T
    : T extends IQrwcSimpleGenericParameter
      ? ISimpleToExpanded<T>
      : never

export type ReadOnlyControl<
  T extends IQrwcExpandedGenericParameter,
  U extends keyof T['components'],
  V extends keyof T['components'][U]['controls']
> = Omit<Control<T, U, V>, 'update'>
