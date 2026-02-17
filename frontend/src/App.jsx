import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    fetch('/api/health/', { signal })
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
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
