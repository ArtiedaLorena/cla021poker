import { useState, useEffect, useCallback, useRef } from 'react'
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

export default function App() {
  const [userKey]               = useState(getUserKey)
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [wasKicked, setWasKicked] = useState(false)
  const leavingVoluntarily      = useRef(false)

  // Restaurar sesión al recargar
  useEffect(() => {
    const restore = async () => {
      const stored = getStoredSession()
      if (!stored) { setLoading(false); return }

      try {
        const room = await svc.getRoom(stored.roomCode)
        if (!room) {
          console.warn('Sala no encontrada, limpiando sesión')
          localStorage.removeItem('cla021_session')
          setLoading(false)
          return
        }
        await svc.joinRoom(room.id, userKey, stored.name, stored.avatar)
        setSession({ ...stored, roomId: room.id })
      } catch (e) {
        console.error('Error restaurando sesión:', e)
        localStorage.removeItem('cla021_session')
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [userKey])

  const join = async ({ name, avatar, roomCode, roomId }) => {
    await svc.joinRoom(roomId, userKey, name, avatar)
    const s = { name, avatar, roomCode, roomId }
    setSession(s)
    localStorage.setItem('cla021_session', JSON.stringify(s))
  }

  // Único punto de salida
  const leave = async () => {
    if (!session) return
    leavingVoluntarily.current = true  // ← marcar salida voluntaria
    try {
      await svc.leaveRoom(session.roomId, userKey)
    } catch (e) {
      console.error('leave error:', e)
    } finally {
      localStorage.removeItem('cla021_session')
      setSession(null)
      leavingVoluntarily.current = false
    }
  }

  // Manejar kick
  const handleKicked = useCallback(() => {
    if (leavingVoluntarily.current) return  // ← ignorar si salió solo
    localStorage.removeItem('cla021_session')
    setSession(null)
    setWasKicked(true)
    setTimeout(() => setWasKicked(false), 5000)
  }, [])

  // Marcar offline al cerrar tab pero NO borrar sesión
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
      {/* Banner kicked */}
      {wasKicked && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          zIndex: 99999,
          background: 'rgba(248,113,113,.12)',
          border: '1px solid rgba(248,113,113,.3)',
          padding: '.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '.6rem',
          fontFamily: "'Syne',sans-serif",
          fontSize: '.85rem',
          color: '#f87171',
          fontWeight: 600,
          backdropFilter: 'blur(12px)',
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