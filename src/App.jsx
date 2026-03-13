import { useState, useEffect, useCallback, useRef, Component } from 'react'
import Lobby from './components/Lobby.jsx'
import Room from './components/Room.jsx'
import * as svc from './lib/roomService.js'

const generateId = () => crypto.randomUUID()

function getUserKey() {
  let key = localStorage.getItem('cla021_userkey')
  if (!key) { key = generateId(); localStorage.setItem('cla021_userkey', key) }
  return key
}

function getStoredSession() {
  try {
    const s = localStorage.getItem('cla021_session')
    return s ? JSON.parse(s) : null
  } catch {
    localStorage.removeItem('cla021_session')
    return null
  }
}

// ── Error Boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', display: 'grid', placeItems: 'center',
          background: '#0d0f14', color: '#e8edf8',
          fontFamily: "'Syne', sans-serif",
          textAlign: 'center', padding: '2rem',
        }}>
          <div>
            <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠</p>
            <h2 style={{ fontWeight: 800, marginBottom: '.5rem' }}>
              Algo salió mal
            </h2>
            <p style={{ color: '#6b7a9e', marginBottom: '1.5rem', fontSize: '.9rem' }}>
              Ocurrió un error inesperado. Por favor recargá la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '.75rem 1.5rem',
                background: '#7c3aed', border: 'none',
                borderRadius: '10px', color: '#fff',
                fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
                fontSize: '.9rem',
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── App Content ───────────────────────────────────────────────────────────
function AppContent() {
  const [userKey]                 = useState(getUserKey)
  const [session, setSession]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [wasKicked, setWasKicked] = useState(false)
  const leavingVoluntarily        = useRef(false)

  useEffect(() => {
    const restore = async () => {
      const stored = getStoredSession()
      if (!stored) {
        setLoading(false)
        return
      }
      try {
        const room = await svc.getRoom(stored.roomCode)
        if (!room) {
          localStorage.removeItem('cla021_session')
          setLoading(false)
          return
        }
        await svc.joinRoom(room.id, userKey, stored.name, stored.avatar)
        setSession({ ...stored, roomId: room.id })
      } catch {
        localStorage.removeItem('cla021_session')
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [userKey])

  // FIX #5 — join con try/catch, re-lanza para que Lobby lo capture
  const join = async ({ name, avatar, roomCode, roomId }) => {
    try {
      await svc.joinRoom(roomId, userKey, name, avatar)
      const s = { name, avatar, roomCode, roomId }
      setSession(s)
      localStorage.setItem('cla021_session', JSON.stringify(s))
    } catch {
      throw new Error('No se pudo unir a la sala. Revisá tu conexión.')
    }
  }

  const leave = async () => {
    if (!session) return
    leavingVoluntarily.current = true
    try {
      await svc.leaveRoom(session.roomId, userKey)
    } catch {
      // silencioso en producción
    } finally {
      localStorage.removeItem('cla021_session')
      setSession(null)
      leavingVoluntarily.current = false
    }
  }

  const handleKicked = useCallback(() => {
    if (leavingVoluntarily.current) return
    localStorage.removeItem('cla021_session')
    setSession(null)
    setWasKicked(true)
    setTimeout(() => setWasKicked(false), 5000)
  }, [])

  useEffect(() => {
    if (!session) return
    const handler = () => svc.markOffline(session.roomId, userKey)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [session, userKey])

  if (loading) return (
    <div style={{
      height: '100vh', display: 'grid', placeItems: 'center',
      background: '#0d0f14', color: '#6b7a9e',
    }}>
      <div style={{ textAlign: 'center' }}>
        <img
          src="./logo.png"
          alt="CLA021POKER"
          style={{
            width: '72px', height: '72px',
            objectFit: 'contain', borderRadius: '16px',
            marginBottom: '1rem',
            boxShadow: '0 8px 32px rgba(124,58,237,.3)',
          }}
        />
        <p style={{ fontFamily: "'Syne',sans-serif", letterSpacing: '.1em' }}>
          Restaurando sesión…
        </p>
      </div>
    </div>
  )

  return (
    <>
      {wasKicked && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          zIndex: 99999,
          background: 'rgba(248,113,113,.12)',
          border: '1px solid rgba(248,113,113,.3)',
          padding: '.75rem 1rem',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '.6rem',
          fontFamily: "'Syne',sans-serif",
          fontSize: '.85rem', color: '#f87171',
          fontWeight: 600, backdropFilter: 'blur(12px)',
        }}>
          <span>⚠</span>
          El facilitador te removió de la sala
        </div>
      )}
      {session
        ? <Room
            roomId={session.roomId}
            roomCode={session.roomCode}
            userKey={userKey}
            onLeave={leave}
            onKicked={handleKicked}
          />
        : <Lobby onJoin={join} userKey={userKey}/>
      }
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}