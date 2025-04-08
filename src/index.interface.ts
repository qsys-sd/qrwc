import type { ControlDecorator } from './managers/components/ControlDecorator'

export interface IControl {
  Name: string
  Component: string
  Choices?: string[]
  Value?: string | number | boolean
  String?: string
  Position?: number
  Type?: string
}

export interface IControlUpdate {
  Name: string
  Value: string | number | boolean
}

export interface IChangeGroup {
  Id: string
  Controls: string[]
}

export interface IComponentChangeGroup {
  Id: string
  Component: {
    Name: string
    Controls: {
      Name: string
    }[]
  }
}

export interface IChangeRequest {
  id: string
  component: string
  onChangeRequest: IOnChangeRequest
}

export interface IOnChangeRequest {
  (message: IChange[]): void
}

interface IDesignMessage {
  jsonrpc: '2.0'
  method?: string
  params?: IParams
  id?: string
}

export interface IMessageAddComponent extends IDesignMessage {
  result: boolean;
}

export interface IMessagePollResult extends IDesignMessage {
  result: IChangePollResult;
}

export interface IMessageControlGetResult extends IDesignMessage {
  result: IControlGetResult;
}

export interface IMessageComponentsGetResult extends IDesignMessage {
  result: IComponent[];
}

export interface IMessageChangeResult extends IDesignMessage {
  result: IChange[];
}

export type IServerMessage = IMessageAddComponent | IMessagePollResult | IMessageControlGetResult | IMessageComponentsGetResult | IMessageChangeResult

export interface IStartOptions {
  componentFilter?: IComponentFilter
  pollingInterval?: IPollingInterval
}

export type IPollingInterval = number

export type IComponentFilter = (component: IComponent) => boolean

interface IParams {
  Platform: string
  State: string
  DesignName: string
  DesignCode: string
  IsRedundant: boolean
  IsEmulator: boolean
  Status: {
    Code: number
    String: string
  }
}

export interface IComponentsGetProperty {
  Name: string;
  Value: string;
  PrettyName: string;
}

export interface IComponent {
  Properties: IComponentsGetProperty[];
  ID: string;
  Name: string;
  Type: string;
  Controls: Record<string, ControlDecorator> | null;
  ControlSource: number;
}

export interface IControlGet {
  Name: string;
  Type: string;
  Choices?: string[];
  Value?: number;
  String: string;
  Direction: string;
  Position?: number;
  ValueMin?: number;
  ValueMax?: number;
  StringMin?: string;
  StringMax?: string;
}

export interface IControlGetResult {
  Name: string;
  Controls: IControlGet[];
}

export interface IChange {
  Component: string;
  Name: string;
  String: string;
  Value: number;
  Position: number;
  Choices?: string[];
  Color?: string;
  Indeterminate?: boolean;
  Invisible?: boolean;
  Disabled?: boolean;
  Legend?: string;
  CssClass?: string;
  Strings?: string[];
}

export interface IChangePollResult {
  Id: string;
  Changes: IChange[];
}

export interface IRequestChanges {
  ResponseValues: boolean;
  Name: string;
  Controls: IControlUpdate[];
}

export interface IRequestControls {
  Name: string;
}

export interface IRequestPoll {
  Id: string;
}

export interface IEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  removeAllListeners(): void;
}

export interface IQrwcEvents {
  message: (message: IServerMessage) => void;
  error: (error: unknown) => void;
  disconnected: (event: string) => void;
  connected: () => void;
  webSocketAttached: () => void;
  startComplete: () => void,
  controlsUpdated: (updatedComponent: IComponent) => void;
  controlsReceived: () => void;
  componentsReceived: (components: Record<string, IComponent>) => void;
  changeRequestSuccessful: (changeRequest: IChangeRequest) => void;
  componentChangeGroupCreated: (changeGroupId: string) => void;
}