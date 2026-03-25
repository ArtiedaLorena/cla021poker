import { useState, useEffect, useCallback, useRef } from 'react'
import { useRoom, CARD_MODES } from '../hooks/useRoom.js'
import PokerTable from './PokerTable.jsx'
import * as svc from '../lib/roomService.js'

// ── Toast ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((msg, type = 'info', duration = 3000) => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])
  return { toasts, addToast }
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '.5rem',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '.7rem 1.1rem',
          borderRadius: '10px',
          fontFamily: "'Syne',sans-serif",
          fontSize: '.85rem',
          fontWeight: 600,
          backdropFilter: 'blur(12px)',
          animation: 'slideIn .2s ease',
          background:
            t.type === 'success' ? 'rgba(34,197,94,.15)'
            : t.type === 'error'   ? 'rgba(248,113,113,.15)'
            : t.type === 'warning' ? 'rgba(251,191,36,.15)'
            : 'rgba(129,140,248,.15)',
          border: `1px solid ${
            t.type === 'success' ? '#22c55e40'
            : t.type === 'error'   ? '#f8717140'
            : t.type === 'warning' ? '#fbbf2440'
            : '#818cf840'
          }`,
          color:
            t.type === 'success' ? '#6ee7b7'
            : t.type === 'error'   ? '#f87171'
            : t.type === 'warning' ? '#fbbf24'
            : '#c7d2fe',
        }}>
          {t.type === 'success' ? '✓ '
            : t.type === 'error'   ? '✕ '
            : t.type === 'warning' ? '⚠ '
            : 'ℹ '}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────
function ConfirmModal({ title, body, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,.7)',
      display: 'grid', placeItems: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#141720', border: '1px solid #2a3050',
        borderRadius: '16px', padding: '1.75rem',
        width: '100%', maxWidth: '340px',
        fontFamily: "'Syne',sans-serif",
        boxShadow: '0 24px 80px #000',
      }}>
        <h3 style={{ fontWeight: 800, marginBottom: '.5rem', color: '#e8edf8' }}>
          {title}
        </h3>
        <p style={{ color: '#6b7a9e', fontSize: '.85rem', marginBottom: '1.25rem' }}>
          {body}
        </p>
        <div style={{ display: 'flex', gap: '.6rem' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '.65rem',
            background: '#1a1e2a', border: '1px solid #2a3050',
            borderRadius: '9px', color: '#6b7a9e',
            cursor: 'pointer', fontWeight: 700,
            fontFamily: "'Syne',sans-serif",
          }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '.65rem',
            background: '#7c3aed', border: 'none',
            borderRadius: '9px', color: '#fff',
            cursor: 'pointer', fontWeight: 700,
            fontFamily: "'Syne',sans-serif",
          }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── History Panel ─────────────────────────────────────────────────────────
function HistoryPanel({ rounds, onBack }) {
  const sorted = [...rounds].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
  return (
    <div className="room">
      <header className="rh">
        <div className="rh-left">
          <img src="/logo.png" alt="CLA021POKER"
            style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '8px' }}
          />
          <span className="rh-title">CLA021POKER</span>
        </div>
        <div className="rh-right">
          <button className="rh-btn" onClick={onBack}>← Volver a la partida</button>
        </div>
      </header>
      <div className="panel">
        {!sorted.length
          ? <div className="empty-state">
              <span>📋</span>
              <p>Sin rondas completadas aún</p>
            </div>
          : <div className="hist-list">
              {sorted.map(h => (
                <div key={h.id} className="hist-item">
                  <div className="hist-top">
                    <span className="hist-story">{h.story}</span>
                    <span className="hist-avg">
                      {h.average}
                      {h.card_mode !== 'tshirt' && ' pts'}
                    </span>
                  </div>
                  <div className="hist-chips">
                    {Object.entries(h.votes_snapshot || {}).map(([key, v]) => (
                      <span key={key} className="hist-chip">
                        {h.participants_snapshot?.[key]?.avatar} <b>{v}</b>
                      </span>
                    ))}
                    {h.card_mode && (
                      <span className="hist-mode-badge">
                        {CARD_MODES[h.card_mode]?.icon} {CARD_MODES[h.card_mode]?.label}
                      </span>
                    )}
                    <span className="hist-time">
                      {new Date(h.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Timer ─────────────────────────────────────────────────────────────────
function useLocalTimer(timerRunning, timerStartedAt, timerDuration) {
  const [displayTime, setDisplayTime] = useState(() => {
    if (!timerRunning || !timerStartedAt) return timerDuration ?? 60
    const elapsed = Math.floor(
      (Date.now() - new Date(timerStartedAt).getTime()) / 1000
    )
    return Math.max(0, (timerDuration ?? 60) - elapsed)
  })

  useEffect(() => {
    if (!timerRunning || !timerStartedAt) {
      setDisplayTime(timerDuration ?? 60)
      return
    }
    const calcTimeLeft = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(timerStartedAt).getTime()) / 1000
      )
      return Math.max(0, (timerDuration ?? 60) - elapsed)
    }
    setDisplayTime(calcTimeLeft())
    const interval = setInterval(() => setDisplayTime(calcTimeLeft()), 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setDisplayTime(calcTimeLeft())
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [timerRunning, timerStartedAt, timerDuration])

  return displayTime
}

// ── Room ──────────────────────────────────────────────────────────────────
export default function Room({ roomId, roomCode, userKey, onLeave, onKicked }) {
  const {
    room, participants, voters, spectators,
    votesMap, rounds, loading,
    isFacilitator, amISpectator, cardMode,
    avg, allAgreed, votedCount, totalCount,
    timerRunning, timerDuration, timerStartedAt,
  } = useRoom(roomId, userKey, onKicked)

  const { toasts, addToast } = useToast()

  // FIX: doble fallback para cards
  const cards = CARD_MODES[cardMode]?.cards ?? CARD_MODES.fibonacci.cards

  const [story,         setStory]         = useState('')
  const [myVote,        setMyVote]        = useState(null)
  const [timerDur,      setTimerDur]      = useState(() => timerDuration || 60)
  const [showHistory,   setShowHistory]   = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [modal,         setModal]         = useState(null)
  const [allVotedPulse, setAllVotedPulse] = useState(false)
  const [togglingRole,  setTogglingRole]  = useState(false)

  const prevVotedCount     = useRef(0)
  const prevRevealed       = useRef(false)
  const autoRevealedRef    = useRef(false)
  const allVotedToastShown = useRef(false)
  const timerDurTimeout    = useRef(null)

  const displayTime = useLocalTimer(timerRunning, timerStartedAt, timerDuration)

  // Debug log — borrar cuando confirmes que funciona
  useEffect(() => {
    if (room) {
      console.log('[Room] card_mode en DB:', room.card_mode)
      console.log('[Room] cardMode resuelto:', cardMode)
      console.log('[Room] cards:', cards)
    }
  }, [room?.card_mode, cardMode])

  // FIX: resetear al cambiar revealed O current_story
  useEffect(() => {
    if (room && !room.revealed) {
      setMyVote(null)
      autoRevealedRef.current    = false
      allVotedToastShown.current = false
    }
  }, [room?.revealed, room?.current_story])

  useEffect(() => {
    if (timerDuration) setTimerDur(timerDuration)
  }, [timerDuration])

  useEffect(() => {
    if (!isFacilitator) setStory('')
  }, [isFacilitator])

  // FIX: inicializar refs cuando lleguen datos reales
  useEffect(() => {
    if (!room) return
    if (prevVotedCount.current === 0 && votedCount > 0) {
      prevVotedCount.current = votedCount
    }
    prevRevealed.current = room.revealed ?? false
  }, [room, votedCount])

  // FIX: toast anti-duplicado
  useEffect(() => {
    if (!room) return
    if (votedCount > prevVotedCount.current) {
      const diff = votedCount - prevVotedCount.current
      addToast(`${diff} participante${diff > 1 ? 's' : ''} votó`, 'info', 2000)
    }
    prevVotedCount.current = votedCount
    if (votedCount > 0 && votedCount === totalCount && !room.revealed) {
      setAllVotedPulse(true)
      if (!allVotedToastShown.current) {
        allVotedToastShown.current = true
        addToast('¡Todos votaron! Podés revelar 🎉', 'success', 4000)
      }
    } else if (!room.revealed) {
      setAllVotedPulse(false)
    }
  }, [votedCount, totalCount, room?.revealed, addToast])

  useEffect(() => {
    if (!room) return
    if (room.revealed && !prevRevealed.current) {
      allAgreed
        ? addToast('¡Consenso total! 🎉', 'success', 5000)
        : addToast('Votos revelados — Analizá los resultados', 'info', 3000)
    }
    prevRevealed.current = room.revealed ?? false
  }, [room?.revealed, allAgreed, addToast])

  useEffect(() => {
    if (
      displayTime <= 0         &&
      timerRunning             &&
      isFacilitator            &&
      !autoRevealedRef.current &&
      !room?.revealed
    ) {
      autoRevealedRef.current = true
      addToast('⏰ Tiempo agotado — revelando votos', 'warning', 3000)
      svc.revealVotes(roomId)
    }
  }, [displayTime, timerRunning, isFacilitator, roomId, room?.revealed, addToast])

  // Set de espectadores para PokerTable
  const spectatorKeySet = new Set(spectators.map(s => s.user_key))

  // ── Acciones ──────────────────────────────────────────────────────────

  const vote = useCallback(async (v) => {
    if (amISpectator || room?.revealed || !room?.current_story) return
    setMyVote(v)
    try {
      await svc.castVote(roomId, userKey, v)
      addToast(`Votaste ${v}`, 'success', 1500)
    } catch {
      addToast('Error al registrar el voto', 'error')
      setMyVote(null)
    }
  }, [amISpectator, room?.revealed, room?.current_story, roomId, userKey, addToast])

  const startRound = async () => {
    if (!story.trim()) return
    try {
      await svc.setStory(roomId, story.trim())
      addToast('¡Ronda iniciada!', 'success')
      setStory('')
    } catch {
      addToast('Error al iniciar la ronda', 'error')
    }
  }

  const reveal = async () => {
    try {
      await svc.revealVotes(roomId)
    } catch {
      addToast('Error al revelar votos', 'error')
    }
  }

  const newRound = () => {
    setModal({
      title: '¿Nueva ronda?',
      body: 'Se borrarán todos los votos actuales y la historia.',
      onConfirm: async () => {
        setModal(null)
        try {
          await svc.resetRound(roomId)
          addToast('Nueva ronda iniciada', 'info')
        } catch {
          addToast('Error al iniciar nueva ronda', 'error')
        }
      },
    })
  }

  const transfer = (toKey) => {
    const target = participants.find(p => p.user_key === toKey)
    setModal({
      title: '¿Transferir rol?',
      body: `¿Querés darle el rol de facilitador a ${target?.name}?`,
      onConfirm: async () => {
        setModal(null)
        try {
          await svc.transferFacilitator(roomId, toKey)
          addToast(`Rol transferido a ${target?.name}`, 'success')
        } catch {
          addToast('Error al transferir el rol', 'error')
        }
      },
    })
  }

  const kickPlayer = (targetKey) => {
    const target = participants.find(p => p.user_key === targetKey)
    setModal({
      title: '¿Remover participante?',
      body: `¿Querés sacar a ${target?.name} de la sala?`,
      onConfirm: async () => {
        setModal(null)
        try {
          await svc.kickParticipant(roomId, targetKey)
          addToast(`${target?.name} fue removido de la sala`, 'warning')
        } catch {
          addToast('Error al remover el participante', 'error')
        }
      },
    })
  }

  // FIX: protección doble click
  const toggleMySpectatorRole = async () => {
    if (isFacilitator || togglingRole) return
    setTogglingRole(true)
    try {
      await svc.setSpectatorRole(roomId, userKey, !amISpectator)
      addToast(
        amISpectator ? '¡Ahora sos jugador! 🃏' : 'Modo espectador activado 👁',
        'info'
      )
    } catch {
      addToast('Error al cambiar el rol', 'error')
    } finally {
      setTogglingRole(false)
    }
  }

  // FIX: validación + guard de modo igual
  const handleCardModeChange = async (mode) => {
    if (mode === cardMode) {
      addToast(`Ya estás en modo ${CARD_MODES[mode]?.label}`, 'info', 1500)
      return
    }
    if (room?.current_story && !room?.revealed) {
      addToast('No podés cambiar el modo durante una votación activa', 'warning')
      return
    }
    try {
      await svc.setCardMode(roomId, mode)
      addToast(
        `Modo cambiado a ${CARD_MODES[mode].label} ${CARD_MODES[mode].icon}`,
        'success'
      )
    } catch (e) {
      console.error('[handleCardModeChange] Error:', e)
      addToast('Error al cambiar el modo', 'error')
    }
  }

  const handleStartTimer = async () => {
    try {
      await svc.startTimer(roomId, timerDur)
      addToast(`Timer iniciado — ${timerDur}s`, 'info')
    } catch {
      addToast('Error al iniciar el timer', 'error')
    }
  }

  const handleStopTimer = async () => {
    try {
      await svc.stopTimer(roomId)
      addToast('Timer detenido', 'warning')
    } catch {
      addToast('Error al detener el timer', 'error')
    }
  }

  // FIX: debounce para evitar múltiples llamadas a DB
  const handleTimerDurChange = (s) => {
    setTimerDur(s)
    if (!timerRunning) {
      clearTimeout(timerDurTimeout.current)
      timerDurTimeout.current = setTimeout(async () => {
        try {
          await svc.updateTimerDuration(roomId, s)
        } catch {
          addToast('Error al actualizar la duración del timer', 'error')
        }
      }, 400)
    }
  }

  const copyCode = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomCode)
      } else {
        const el = document.createElement('textarea')
        el.value = roomCode
        el.style.position = 'fixed'
        el.style.opacity  = '0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopied(true)
      addToast('Código copiado 📋', 'success', 1500)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('No se pudo copiar el código', 'error')
    }
  }

  const handleLeave = () => {
    setModal({
      title: '¿Salir de la sala?',
      body: 'Si salís, tu sesión se cerrará. Podés volver a unirte con el mismo código.',
      onConfirm: () => { setModal(null); onLeave?.() },
    })
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      height: '100vh', display: 'grid', placeItems: 'center',
      background: '#0d0f14', color: '#6b7a9e',
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="./logo.png" alt="CLA021POKER" style={{
          width: '72px', height: '72px', objectFit: 'contain',
          borderRadius: '16px', marginBottom: '1rem',
          boxShadow: '0 8px 32px rgba(124,58,237,.3)',
        }}/>
        <p style={{ fontFamily: "'Syne',sans-serif" }}>Conectando a la sala…</p>
      </div>
    </div>
  )

  if (showHistory) return (
    <HistoryPanel rounds={rounds} onBack={() => setShowHistory(false)}/>
  )

  // ── Variables derivadas ───────────────────────────────────────────────
  const timerPct    = displayTime / Math.max(timerDur, 1)
  const timerR      = 44
  const timerCirc   = 2 * Math.PI * timerR
  const urgent      = displayTime <= 10 && timerRunning
  const mins        = Math.floor(displayTime / 60)
  const secs        = displayTime % 60
  const timeDisplay = mins > 0
    ? `${mins}:${secs.toString().padStart(2, '0')}`
    : `${displayTime}s`

  const roundActive = !!room?.current_story
  const isRevealed  = room?.revealed ?? false

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="room">
      <ToastContainer toasts={toasts}/>
      {modal && (
        <ConfirmModal
          title={modal.title}
          body={modal.body}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* ── HEADER ── */}
      <header className="rh">
        <div className="rh-left">
          <img src="./logo.png" alt="CLA021POKER" style={{
            width: '45px', height: '45px',
            objectFit: 'contain', borderRadius: '8px',
          }}/>
          <span className="rh-title">CLA021POKER</span>
          <span className="rh-sala">
            Sala: <b>{roomCode}</b>
            <button className="rh-copy" onClick={copyCode} title="Copiar código">
              {copied ? '✓' : '⧉'}
            </button>
          </span>
          {/* FIX: badge siempre visible con fallback */}
          <span className="rh-mode-badge">
            {CARD_MODES[cardMode]?.icon ?? '🔢'}{' '}
            {CARD_MODES[cardMode]?.label ?? 'Fibonacci'}
          </span>
        </div>

        <div className="rh-right">
          {amISpectator && (
            <span className="rh-spectator-badge">👁 ESPECTADOR</span>
          )}
          {roundActive && !isRevealed && (
            <span style={{
              padding: '.3rem .7rem', borderRadius: '7px',
              background: 'rgba(34,197,94,.1)',
              border: '1px solid #22c55e40',
              color: '#22c55e', fontSize: '.72rem',
              fontWeight: 700, letterSpacing: '.05em',
            }}>
              ● EN VOTACIÓN
            </span>
          )}
          {isRevealed && (
            <span style={{
              padding: '.3rem .7rem', borderRadius: '7px',
              background: 'rgba(251,191,36,.1)',
              border: '1px solid #fbbf2440',
              color: '#fbbf24', fontSize: '.72rem',
              fontWeight: 700, letterSpacing: '.05em',
            }}>
              ● REVELADO
            </span>
          )}
          <button className="rh-btn" onClick={() => setShowHistory(true)}>
            🕐 Historial
          </button>
          {isFacilitator && (
            <span className="rh-facilitator">👑 Facilitador</span>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="room-body">

        {/* ── LEFT PANEL ── */}
        <aside className="left-panel">

          {isFacilitator && !roundActive && !isRevealed && (
            <div className="fac-hint">
              <div className="fac-hint-icon">👆</div>
              <div className="fac-hint-body">
                <span className="fac-hint-title">¡Empezá la ronda!</span>
                <span className="fac-hint-text">
                  Escribí el nombre de la historia y presioná{' '}
                  <b>Iniciar Ronda</b> para que el equipo pueda votar.
                </span>
              </div>
            </div>
          )}

          {/* FIX: selector visible para facilitador entre rondas */}
          {isFacilitator && !roundActive && (
            <div className="lp-section">
              <div className="lp-label">Modo de estimación</div>
              <div className="lp-mode-selector">
                {Object.entries(CARD_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    className={`lp-mode-btn ${cardMode === key ? 'active' : ''}`}
                    onClick={() => handleCardModeChange(key)}
                    title={`Cambiar a ${mode.label}`}
                  >
                    <span className="lp-mode-btn-icon">{mode.icon}</span>
                    <span className="lp-mode-btn-label">{mode.label}</span>
                  </button>
                ))}
              </div>
              {/* Indicador modo actual */}
              <div style={{
                fontSize: '.7rem',
                color: 'var(--tx2)',
                textAlign: 'center',
                padding: '.15rem 0',
              }}>
                Activo: <b style={{ color: '#c4b5fd' }}>
                  {CARD_MODES[cardMode]?.label ?? cardMode}
                </b>
              </div>
            </div>
          )}

          {/* Historia actual */}
          <div className="lp-section">
            <div className="lp-label">Historia actual</div>
            {isFacilitator
              ? <>
                  <input
                    className="lp-story-input"
                    value={story}
                    onChange={e => setStory(e.target.value)}
                    placeholder="Escribí la historia a estimar..."
                    onKeyDown={e => e.key === 'Enter' && startRound()}
                  />
                  {!roundActive && story.trim() && (
                    <button
                      className="rp-action-btn rp-go"
                      onClick={startRound}
                      style={{ marginTop: '.3rem' }}
                    >
                      ▶ Iniciar Ronda
                    </button>
                  )}
                </>
              : <div className="lp-story-display">
                  {room?.current_story || (
                    <span className="lp-waiting">Esperando al facilitador…</span>
                  )}
                </div>
            }
          </div>

          {/* Cartas — ocultas para espectadores */}
          {!amISpectator && (
            <div className="lp-section">
              <div className="lp-label">Tu voto</div>
              <div className="lp-vote-display">
                {myVote
                  ? <span className="lp-vote-val">{myVote}</span>
                  : <span className="lp-vote-empty">—</span>
                }
              </div>
              <div className="lp-cards">
                {cards.map(v => (
                  <button
                    key={v}
                    className={`lp-card ${myVote === v ? 'sel' : ''} ${isRevealed || !roundActive ? 'dis' : ''}`}
                    onClick={() => vote(v)}
                    disabled={isRevealed || !roundActive}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {roundActive && !isRevealed && (
                <div className={`lp-confirm-btn ${myVote ? 'ready' : 'waiting'}`}>
                  {myVote ? '✓ Voto registrado' : 'Elegí una carta…'}
                </div>
              )}
            </div>
          )}

          {/* Banner espectador */}
          {amISpectator && (
            <div className="lp-section">
              <div className="lp-spectator-banner">
                <span className="lp-spectator-banner-icon">👁</span>
                <span className="lp-spectator-banner-title">Modo espectador</span>
                <span className="lp-spectator-banner-desc">
                  Estás observando la partida
                </span>
              </div>
              {!isFacilitator && !roundActive && (
                <button
                  className="lp-role-btn lp-role-btn-join"
                  onClick={toggleMySpectatorRole}
                  disabled={togglingRole}
                  style={{ marginTop: '.6rem' }}
                >
                  {togglingRole ? '…' : '🃏 Unirme como jugador'}
                </button>
              )}
            </div>
          )}

          {/* Botón jugador → espectador */}
          {!amISpectator && !isFacilitator && !roundActive && (
            <div className="lp-section">
              <button
                className="lp-role-btn lp-role-btn-spectate"
                onClick={toggleMySpectatorRole}
                disabled={togglingRole}
              >
                {togglingRole ? '…' : '👁 Cambiar a espectador'}
              </button>
            </div>
          )}

          {/* Lista de jugadores */}
          <div className="lp-section">
            <div className="lp-label-row">
              <span className="lp-label">Jugadores ({voters.length})</span>
              <span className="lp-label-icon">⇅</span>
            </div>
            <div className="lp-player-list">
              {voters.map(p => (
                <div
                  key={p.user_key}
                  className={`lp-player ${p.user_key === userKey ? 'me' : ''}`}
                >
                  <span className="lp-player-av">{p.avatar}</span>
                  <span className="lp-player-name">
                    {p.name}{p.user_key === userKey ? ' (tú)' : ''}
                  </span>
                  {p.user_key === room?.facilitator_id && (
                    <span title="Facilitador" style={{ fontSize: '.75rem' }}>👑</span>
                  )}
                  {!isRevealed && votesMap[p.user_key] !== undefined && (
                    <span className="lp-voted">✓</span>
                  )}
                  {isRevealed && votesMap[p.user_key] && (
                    <span className="lp-vote-shown">{votesMap[p.user_key]}</span>
                  )}
                  {isFacilitator
                    && p.user_key !== userKey
                    && p.user_key !== room?.facilitator_id && (
                    <button
                      className="lp-kick-btn"
                      onClick={() => kickPlayer(p.user_key)}
                      title={`Remover a ${p.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Lista de espectadores */}
          {spectators.length > 0 && (
            <div className="lp-section">
              <div className="lp-label-row">
                <span className="lp-label">
                  Espectadores ({spectators.length})
                </span>
                <span style={{ fontSize: '.85rem' }}>👁</span>
              </div>
              <div className="lp-player-list">
                {spectators.map(p => (
                  <div
                    key={p.user_key}
                    className={`lp-player spectator ${p.user_key === userKey ? 'me' : ''}`}
                  >
                    <span className="lp-player-av">{p.avatar}</span>
                    <span className="lp-player-name">
                      {p.name}{p.user_key === userKey ? ' (tú)' : ''}
                    </span>
                    <span className="lp-spectator-icon-sm">👁</span>
                    {isFacilitator && p.user_key !== userKey && (
                      <button
                        className="lp-kick-btn"
                        onClick={() => kickPlayer(p.user_key)}
                        title={`Remover a ${p.name}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="lp-leave" onClick={handleLeave}>
            ← Salir de la sala
          </button>
        </aside>

        {/* ── CENTER: TABLE ── */}
        <main className="table-area">
          <div className="table-wrap">
            <PokerTable
              participants={participants}
              spectatorKeys={spectatorKeySet}
              votesMap={votesMap}
              revealed={isRevealed}
              myKey={userKey}
              facilitatorKey={room?.facilitator_id}
              onTransfer={transfer}
              currentStory={room?.current_story || ''}
              avg={avg}
              allAgreed={allAgreed}
              votedCount={votedCount}
              totalCount={totalCount}
            />
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="right-panel">

          {/* Timer */}
          <div className="rp-section">
            <div className="rp-label">Temporizador</div>
            <div className="rp-timer-card">
              <svg width="120" height="120" viewBox="0 0 110 110"
                style={{ display: 'block', margin: '0 auto' }}>
                <circle cx="55" cy="55" r={timerR}
                  fill="none" stroke="#1f2a3a" strokeWidth="8"/>
                <circle cx="55" cy="55" r={timerR}
                  fill="none"
                  stroke={urgent ? '#f87171' : timerRunning ? '#3b82f6' : '#4b5a7a'}
                  strokeWidth="8"
                  strokeDasharray={`${timerCirc * timerPct} ${timerCirc}`}
                  strokeLinecap="round"
                  transform="rotate(-90 55 55)"
                  style={{ transition: 'stroke-dasharray 1s linear, stroke .3s' }}
                />
                <text x="55" y="63" textAnchor="middle"
                  fontSize="20" fontWeight="800"
                  fontFamily="'JetBrains Mono',monospace"
                  fill={urgent ? '#f87171' : '#dde4f5'}>
                  {timeDisplay}
                </text>
              </svg>

              {isFacilitator && (
                <>
                  <div className="rp-timer-btns">
                    {[30, 60, 90, 120].map(s => (
                      <button
                        key={s}
                        className={`rp-tbtn ${timerDur === s ? 'on' : ''}`}
                        onClick={() => handleTimerDurChange(s)}
                        disabled={timerRunning}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                  {timerRunning
                    ? <button
                        className="rp-action-btn rp-stop"
                        onClick={handleStopTimer}
                      >
                        ⏹ Detener
                      </button>
                    : <button
                        className="rp-action-btn rp-start"
                        onClick={handleStartTimer}
                        disabled={!roundActive}
                      >
                        ▶ Iniciar
                      </button>
                  }
                </>
              )}
            </div>
          </div>

          {/* Revelar / Nueva ronda */}
          {isFacilitator && (
            <div className="rp-section">
              {isRevealed
                ? <button className="rp-action-btn rp-new" onClick={newRound}>
                    ↺ Nueva Ronda
                  </button>
                : <button
                    className={`rp-action-btn rp-reveal ${allVotedPulse ? 'pulse' : ''}`}
                    onClick={reveal}
                    disabled={!roundActive}
                  >
                    ▶ Revelar Votos
                    {votedCount > 0 && ` (${votedCount}/${totalCount})`}
                  </button>
              }
            </div>
          )}

          {/* Estadísticas */}
          <div className="rp-section">
            <div className="rp-label">Estadísticas</div>
            <div className="rp-stat-row">
              <span className="rp-stat-lbl">Votaron:</span>
              <span className="rp-stat-val">{votedCount}/{totalCount}</span>
            </div>
            <div className="rp-prog-track">
              <div
                className="rp-prog-fill"
                style={{
                  width: `${totalCount ? (votedCount / totalCount) * 100 : 0}%`
                }}
              />
            </div>
            {spectators.length > 0 && (
              <div className="rp-stat-row" style={{ marginTop: '.4rem' }}>
                <span className="rp-stat-lbl">Espectadores:</span>
                <span className="rp-stat-val rp-stat-spectators">
                  {spectators.length}
                </span>
              </div>
            )}
          </div>

          {/* Distribución post-reveal */}
          {isRevealed && avg && (
            <div className="rp-section">
              <div className="rp-label">Distribución</div>
              <div className="rp-avg">
                {cardMode === 'tshirt' ? 'Resultado: ' : 'Promedio: '}
                <b>{avg}</b>
                {allAgreed && ' ✓ Consenso'}
              </div>
              {cards
                .filter(f => f !== '☕' && f !== '?')
                .map(f => {
                  const cnt = Object.values(votesMap).filter(v => v === f).length
                  if (!cnt) return null
                  const who = voters.filter(p => votesMap[p.user_key] === f)
                  return (
                    <div key={f} className="res-row">
                      <span className="res-val">{f}</span>
                      <div className="res-track">
                        <div
                          className="res-bar"
                          style={{
                            width: `${totalCount ? (cnt / totalCount) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <span className="res-avs">
                        {who.map(p => p.avatar).join('')}
                      </span>
                      <span className="res-cnt">{cnt}x</span>
                    </div>
                  )
                })
              }
            </div>
          )}

          {/* Historial rápido */}
          <div className="rp-section rp-hist-section">
            <div className="rp-label">Historial de votación</div>
            {rounds.length === 0
              ? <div className="rp-empty">Sin historias completadas</div>
              : [...rounds]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .slice(0, 4)
                  .map(h => (
                    <div key={h.id} className="rp-hist-row">
                      <span className="rp-hist-story">{h.story}</span>
                      <span className="rp-hist-avg">
                        {h.average}
                        {h.card_mode !== 'tshirt' && ' pts'}
                      </span>
                    </div>
                  ))
            }
            {rounds.length > 0 && (
              <button
                className="rp-hist-link"
                onClick={() => setShowHistory(true)}
              >
                Ver todo →
              </button>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}