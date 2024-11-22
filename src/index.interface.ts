import { ControlDecorator } from './managers/control/ControlDecorator'

export interface IControl {
  Name: string
  Component?: string
  Value?: string | number | boolean
  String?: string
  Position?: number
  Type?: string
}

export interface IComponent {
  [componentName: string]: {
    [controlName: string]: ControlDecorator
  }
}

export interface IChangeGroup {
  Id: string
  Controls: string[]
}

export interface IComponentChangeGroup {
  Id: string
  Component: {
    Name: string
    Controls: IControl[]
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
  result: IComponentsGetResult[];
}

export interface IMessageChangeResult extends IDesignMessage {
  result: IChange[];
}

export type IServerMessage = IMessageAddComponent | IMessagePollResult | IMessageControlGetResult | IMessageComponentsGetResult | IMessageChangeResult


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

interface IComponentsGetProperty {
  Name: string;
  Value: string;
  PrettyName: string;
}

export interface IComponentsGetResult {
  Properties: IComponentsGetProperty[];
  ID: string;
  Name: string;
  Type: string;
  Controls: null;
  ControlSource: number;
}

export interface IControlGet {
  Name: string;
  Type: string;
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
  Controls: IControl[];
}

export interface IRequestControls {
  Name: string;
}

export interface IRequestPoll {
  Id: string;
}
