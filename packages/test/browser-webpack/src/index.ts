import { Qrwc } from '@q-sys/qrwc'

const testElement = document.getElementById('test')
const test = async () => {
  const socket = new WebSocket('ws://localhost:3102')

  const qrwc = await Qrwc.createQrwc({ socket })
  if (qrwc.components.TestComponent1 && testElement) {
    testElement.textContent = qrwc.components.TestComponent1.name
    testElement.click()
  }
}

void test()
