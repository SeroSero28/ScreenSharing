import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import 'bootstrap/dist/css/bootstrap.min.css'; // Bootstrap CSS'ini ekle
import './index.css'; // Global custom styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)