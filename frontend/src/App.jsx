import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    fetch('/api/health/', { signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Health check request failed')
        }
        return res.json()
      })
      .then((data) => {
        if (data && typeof data.status === 'string') {
          setStatus(data.status)
        } else {
          setStatus('error')
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return
        }
        setStatus('error')
      })

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <div className="App">
      <h1>Cheat Sheet</h1>
      <p>Backend status: {status ?? 'loading...'}</p>
    </div>
  )
}

export default App
