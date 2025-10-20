import { Qrwc } from '@q-sys/qrwc'
import { WebSocket } from 'ws'

const test = async () => {
  const socket = new WebSocket('ws://localhost:3104')
  const qrwc = await Qrwc.createQrwc({ socket })
  if (
    qrwc.components.TestComponent1 &&
    qrwc.components.TestComponent1.name !== 'TestComponent1'
  ) {
    qrwc.close()
    console.warn(
      ' \x1b[30m\x1b[41m FAIL \x1b[0m - \x1b[30m\x1b[47m node-esm \x1b[0m'
    )
    process.exit(1)
  } else {
    qrwc.close()
    console.log(
      ' \x1b[30m\x1b[42m PASS \x1b[0m - \x1b[30m\x1b[47m node-esm \x1b[0m'
    )
    process.exit(0)
  }
}

void test()
