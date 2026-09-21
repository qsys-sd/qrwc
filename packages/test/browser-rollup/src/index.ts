import { Qrwc } from '@q-sys/qrwc'

const testElement = document.getElementById('test')
const test = async () => {
  const socket = new WebSocket('ws://localhost:3101')

  const qrwc = await Qrwc.createQrwc({ socket, apiKey: 'test' })
  if (testElement) {
    // A startup failure (undefined qrwc) sets a non-matching value so the harness fails fast.
    testElement.textContent =
      qrwc?.components.TestComponent1?.name ?? 'STARTUP_FAILURE'
    testElement.click()
  }
}

void test()
