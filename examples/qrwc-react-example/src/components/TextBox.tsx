import React, { useEffect, useState } from 'react'
import { TextField } from '@mui/material'
import { useQrwc } from '../context/QrwcContext'
import { IControlState } from '@q-sys/qrwc'

function TextBox() {
  const { text } = useQrwc()
  const [textString, setTextString] = useState('')

  useEffect(() => {
    const listener = (state: IControlState) => {
      setTextString(state.String)
    }
    text?.on('update', listener)

    return () => {
      text?.removeListener('update', listener)
    }
  }, [text])

  // check if control exists
  if (!text) {
    return null
  }

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setTextString(event.target.value)
    text?.update(event.target.value)
  }

  return (
    <TextField
      id="outlined-required"
      label="Text Box Control"
      value={textString}
      onChange={handleChange}
    />
  )
}

export default TextBox
