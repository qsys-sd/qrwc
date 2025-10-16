import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import QrwcProvider from './context/QrwcContext'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <QrwcProvider>
    <App />
  </QrwcProvider>
)
