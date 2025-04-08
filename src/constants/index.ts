import { IComponent } from '../index.interface'

export const qrcMethods = {
  components: {
    getComponents: 'Component.GetComponents',
    getControls: 'Component.GetControls',
    set: 'Component.Set'
  },
  changeGroup: {
    poll: 'ChangeGroup.Poll',
    addControl: 'ChangeGroup.AddControl',
    addComponentControl: 'ChangeGroup.AddComponentControl'
  }
} as const

export const QrwcPollReset = 30000
export const QrwcMinPollInterval = 34
export const QrwcDefaultPollInterval = 350

export const qrwcMockComponentGetResult: IComponent = {
  Name: 'mock',
  Properties: [],
  ID: 'mock',
  Type: 'mock',
  Controls: null,
  ControlSource: 1
}
