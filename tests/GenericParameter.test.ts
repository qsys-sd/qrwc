/**
 * Compile-time type tests for the Qrwc generic parameter.
 *
 * The generic parameter accepts either the expanded
 * (IQrwcExpandedGenericParameter) format or the simplified
 * (IQrwcSimpleGenericParameter) format. These assertions are verified by the
 * test:types type-check (tsc --noEmit); if the public typing regresses, that
 * step fails. None of the type-only function bodies below are executed at
 * runtime.
 */
import { Qrwc } from '../src/entities/Qrwc'
import type { Component } from '../src/entities/Component'
import type { Control } from '../src/entities/Control'
import type {
  IControlState,
  INormalizedQrwcParameter,
  IQrwcExpandedGenericParameter,
  IStartOptions,
  ReadOnlyControl
} from '../src/index.interface'
import { expectNever, expectToBe } from './QRWC_Test_Types'
import type { QRWC_Expanded_Type, QRWC_Simple_Type } from './QRWC_Test_Types'

// createQrwc only needs options for typing; the test bodies never run.
const options = {} as IStartOptions

async function expandedFormatTest() {
  const qrwc = await Qrwc.createQrwc<QRWC_Expanded_Type>(options)
  // createQrwc resolves to void on failure; narrow to the instance for typing
  if (!qrwc) return

  // --- components: keyed by their exact literal names (non-optional) ---
  expectToBe<Component<QRWC_Expanded_Type, 'Gain_0'>>(qrwc.components.Gain_0)
  expectToBe<Component<QRWC_Expanded_Type, 'Meter_0'>>(qrwc.components.Meter_0)
  // @ts-expect-error - 'Nonexistent' is not a component in the design
  const _noSuchComponent = qrwc.components.Nonexistent

  // --- read/write control: precise, per-control state ---
  const gain = qrwc.components.Gain_0.controls.gain
  expectToBe<Control<QRWC_Expanded_Type, 'Gain_0', 'gain'>>(gain)

  const gainState = gain.state
  expectToBe<'gain'>(gainState.Name)
  expectToBe<'Float'>(gainState.Type)
  expectToBe<'Read/Write'>(gainState.Direction)
  expectToBe<'Gain_0'>(gainState.Component)
  expectToBe<number>(gainState.Value)
  expectToBe<number>(gainState.ValueMin)
  expectToBe<boolean>(gainState.Bool)

  // per-control precision: bypass is a Boolean control with no ValueMin
  expectToBe<'bypass'>(qrwc.components.Gain_0.controls.bypass.state.Name)
  // @ts-expect-error - Boolean controls have no ValueMin on their state
  const _noValueMin = qrwc.components.Gain_0.controls.bypass.state.ValueMin

  // --- read/write capability: update is present and precisely typed ---
  const updatedGain = await gain.update(0.5)
  expectToBe<'gain'>(updatedGain.Name)
  expectToBe<'Read/Write'>(updatedGain.Direction)
  void gain.update('0 dB')
  void gain.update(true)
  void gain.update({ Value: 0.5 })
  void gain.update({ Position: 0.5 })
  void gain.update({ Bool: true })
  // @ts-expect-error - 'Values' is not a settable field on this control
  void gain.update({ Values: [1] })

  // --- read-only control: update is absent ---
  const level = qrwc.components.Meter_0.controls.level
  expectToBe<ReadOnlyControl<QRWC_Expanded_Type, 'Meter_0', 'level'>>(level)
  expectToBe<'Read Only'>(level.state.Direction)
  // read-only controls expose no 'update' key ...
  expectNever<Extract<keyof typeof level, 'update'>>()
  // ... and calling update is a type error
  // @ts-expect-error - read-only controls have no update method
  void level.update(0.5)

  // --- listeners ---
  qrwc.on('update', (component) => {
    expectToBe<
      Component<QRWC_Expanded_Type, keyof QRWC_Expanded_Type['components']>
    >(component)
  })
  qrwc.on('disconnected', (reason) => expectToBe<string>(reason))
  qrwc.on('error', (error) => expectToBe<Error>(error))

  qrwc.components.Gain_0.on('update', (control, state) => {
    expectToBe<
      Control<
        QRWC_Expanded_Type,
        'Gain_0',
        'bypass' | 'gain' | 'invert' | 'mute'
      >
    >(control)
    expectToBe<'bypass' | 'gain' | 'invert' | 'mute'>(state.Name)
  })
  qrwc.components.Gain_0.on('error', (error) => expectToBe<Error>(error))

  qrwc.components.Gain_0.controls.gain.on('update', (state) => {
    expectToBe<'gain'>(state.Name)
    expectToBe<'Read/Write'>(state.Direction)
    // a control's listener state is directly usable in a similar control's update
    void qrwc.components.Gain_1.controls.gain.update(state)
  })
}

async function simpleFormatTest() {
  const qrwc = await Qrwc.createQrwc<QRWC_Simple_Type>(options)
  if (!qrwc) return

  // The simple format is normalized to the expanded shape internally.
  type Normalized = INormalizedQrwcParameter<QRWC_Simple_Type>

  // --- components and controls resolve from the control-name unions ---
  expectToBe<Component<Normalized, 'Gain_0'>>(qrwc.components.Gain_0)
  const gain = qrwc.components.Gain_0.controls.gain
  const mute = qrwc.components.Gain_0.controls.mute
  expectToBe<Control<Normalized, 'Gain_0', 'gain'>>(gain)
  expectToBe<Control<Normalized, 'Gain_0', 'mute'>>(mute)
  expectToBe<Control<Normalized, 'Gain_1', 'gain'>>(
    qrwc.components.Gain_1.controls.gain
  )

  // @ts-expect-error - Gain_1 has no 'mute' control in the simple format
  const _noMuteOnGain1 = qrwc.components.Gain_1.controls.mute
  // @ts-expect-error - 'Nonexistent' is not a component in the simple format
  const _noSuchSimpleComponent = qrwc.components.Nonexistent

  // --- simple-format controls carry the generic IControlState ---
  const gainState = gain.state
  expectToBe<IControlState>(gainState)
  expectToBe<boolean>(gainState.Bool)
  expectToBe<number | undefined>(gainState.Value)

  // --- read/write capability: simple-format controls are always writable ---
  const updated = await gain.update(0.5)
  expectToBe<IControlState>(updated)

  // --- listeners receive the normalized types ---
  qrwc.components.Gain_0.on('update', (control, state) => {
    expectToBe<Control<Normalized, 'Gain_0', 'gain' | 'mute'>>(control)
    expectToBe<IControlState>(state)
  })
  qrwc.components.Gain_0.controls.gain.on('update', (state) => {
    expectToBe<IControlState>(state)
  })
}

async function defaultFormatTest() {
  // No generic parameter: T defaults to IQrwcExpandedGenericParameter.
  const qrwc = await Qrwc.createQrwc(options)
  if (!qrwc) return
  expectToBe<Qrwc<IQrwcExpandedGenericParameter>>(qrwc)

  // --- any component/control name is allowed, but resolves to `| undefined` ---
  const someComponent = qrwc.components.AnyComponentName
  expectToBe<Component<IQrwcExpandedGenericParameter, string> | undefined>(
    someComponent
  )
  // the record is open, so every lookup is possibly undefined
  expectToBe<typeof qrwc.components.AnyComponentName>(undefined)

  const someControl = qrwc.components.AnyComponentName?.controls.AnyControlName
  expectToBe<
    Control<IQrwcExpandedGenericParameter, string, string> | undefined
  >(someControl)

  // --- state is the generic IControlState ---
  expectToBe<IControlState | undefined>(someControl?.state)

  // --- read/write capability: controls are writable ---
  const updated = await someControl?.update(0.5)
  expectToBe<IControlState | undefined>(updated)

  // --- listeners receive the generic component, control, and state ---
  qrwc.on('update', (component, control, state) => {
    expectToBe<string>(component.name)
    expectToBe<string>(control.name)
    expectToBe<IControlState>(state)
  })
  qrwc.on('disconnected', (reason) => expectToBe<string>(reason))
  qrwc.on('error', (error) => expectToBe<Error>(error))
}

describe('Qrwc generic parameter', () => {
  it('resolves the expanded, simple, and default formats at compile time', () => {
    // The assertions live in the type-only functions above; the test:types
    // type-check fails the build if any of them stop type-checking. Referencing
    // the functions keeps the linter happy and gives Jest a runnable assertion.
    expect(typeof expandedFormatTest).toBe('function')
    expect(typeof simpleFormatTest).toBe('function')
    expect(typeof defaultFormatTest).toBe('function')
  })
})
