import { useState } from 'react'
import * as svc from '../lib/roomService.js'

const AVATARS = [
  { id: 'fox',       icon: '🦊', label: 'Fox',      color: '#e8530a' },
  { id: 'wolf',      icon: '🐺', label: 'Wolf',     color: '#6b7a9e' },
  { id: 'bear',      icon: '🐻', label: 'Bear',     color: '#8B5E3C' },
  { id: 'lion',      icon: '🦁', label: 'Lion',     color: '#d4a017' },
  { id: 'tiger',     icon: '🐯', label: 'Tiger',    color: '#c0392b' },
  { id: 'panda',     icon: '🐼', label: 'Panda',    color: '#4a4a4a' },
  { id: 'penguin',   icon: '🐧', label: 'Penguin',  color: '#0ea5e9' },
  { id: 'owl',       icon: '🦉', label: 'Owl',      color: '#7c3aed' },
  { id: 'dragon',    icon: '🐲', label: 'Dragon',   color: '#16a085' },
  { id: 'robot',     icon: '🤖', label: 'Robot',    color: '#2980b9' },
  { id: 'alien',     icon: '👾', label: 'Alien',    color: '#22c55e' },
  { id: 'ninja',     icon: '🥷', label: 'Ninja',    color: '#1a1a2e' },
  { id: 'wizard',    icon: '🧙', label: 'Wizard',   color: '#7c3aed' },
  { id: 'knight',    icon: '🧝', label: 'Knight',   color: '#1e6b3a' },
  { id: 'astronaut', icon: '🧑‍🚀', label: 'Astro', color: '#1e4d8c' },
]

const CARD_MODES = [
  { value: 'fibonacci', icon: '🔢', label: 'Fibonacci', desc: '1, 2, 3, 5, 8…' },
  { value: 'tshirt',    icon: '👕', label: 'T-Shirt',   desc: 'XS, S, M, L, XL…' },
]

export default function Lobby({ onJoin, userKey }) {
  const [name,        setName]        = useState('')
  const [code,        setCode]        = useState('')
  const [tab,         setTab]         = useState('create')
  const [err,         setErr]         = useState('')
  const [loading,     setLoading]     = useState(false)
  const [avatar,      setAvatar]      = useState(AVATARS[0])
  const [step,        setStep]        = useState(1)
  const [cardMode,    setCardMode]    = useState('fibonacci')
  const [isSpectator, setIsSpectator] = useState(false)

  const go = async () => {
    if (!name.trim()) { setErr('Ingresá tu nombre'); return }
    if (tab === 'join') {
      const trimmed = code.replace(/\s/g, '').toUpperCase()
      if (trimmed.length !== 5 || !/^[A-Z0-9]{5}$/.test(trimmed)) {
        setErr('El código debe tener 5 caracteres alfanuméricos')
        return
      }
    }
    setErr('')
    setLoading(true)
    try {
      if (tab === 'create') {
        const room = await svc.createRoom(userKey, cardMode)
        await onJoin({
          name:        name.trim(),
          avatar:      avatar.icon,
          roomCode:    room.code,
          roomId:      room.id,
          isSpectator: false,
        })
      } else {
        const cleanCode = code.replace(/\s/g, '').toUpperCase()
        const room = await svc.getRoom(cleanCode)
        if (!room) { setErr('Sala no encontrada'); setLoading(false); return }
        await onJoin({
          name:        name.trim(),
          avatar:      avatar.icon,
          roomCode:    room.code,
          roomId:      room.id,
          isSpectator,
        })
      }
    } catch (e) {
      setErr(e?.message || 'Error al conectar. Revisá tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-bg">
        <div className="lobby-orb orb-1"/>
        <div className="lobby-orb orb-2"/>
        <div className="lobby-orb orb-3"/>
      </div>

      <div className="lb-card">

        {/* ── LOGO ── */}
        <div className="lb-logo">
          <div className="lb-logo-img">
            <img
              src="/logo.png"
              alt="CLA021POKER"
              style={{
                width: '65px', height: '65px',
                borderRadius: '15px',
                objectFit: 'contain',
              }}
            />
            <div className="lb-logo-ring"/>
          </div>
          <h1 className="lb-title">CLA021POKER</h1>
          <p className="lb-subtitle">Estimación ágil · Fibonacci · T-shirt · Tiempo real</p>
        </div>

        {/* ── TABS ── */}
        <div className="lb-tabs">
          <button
            className={`lb-tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => { setTab('create'); setErr(''); setIsSpectator(false) }}
          >
            <span className="lb-tab-icon">✦</span>
            Crear sala
          </button>
          <button
            className={`lb-tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => { setTab('join'); setErr('') }}
          >
            <span className="lb-tab-icon">⇢</span>
            Unirse
          </button>
        </div>

        {/* ── STEPS ── */}
        <div className="lb-steps">
          <div className={`lb-step ${step >= 1 ? 'done' : ''}`}>
            <div className="lb-step-dot">{step > 1 ? '✓' : '1'}</div>
            <span>Avatar</span>
          </div>
          <div className="lb-step-line"/>
          <div className={`lb-step ${step >= 2 ? 'done' : ''}`}>
            <div className="lb-step-dot">2</div>
            <span>Nombre</span>
          </div>
        </div>

        {/* ── PASO 1: Avatar ── */}
        {step === 1 && (
          <div className="lb-step-content">
            <p className="lb-step-title">Elegí tu personaje</p>
            <div className="av-grid-new">
              {AVATARS.map(a => (
                <button
                  key={a.id}
                  className={`av-btn-new ${avatar.id === a.id ? 'on' : ''}`}
                  onClick={() => setAvatar(a)}
                  style={{ '--av-color': a.color }}
                  title={a.label}
                >
                  <span className="av-btn-icon">{a.icon}</span>
                  {avatar.id === a.id && <span className="av-btn-check">✓</span>}
                </button>
              ))}
            </div>

            <div className="av-preview">
              <div
                className="av-preview-bubble"
                style={{
                  background:  avatar.color + '22',
                  borderColor: avatar.color + '55',
                }}
              >
                <span className="av-preview-icon">{avatar.icon}</span>
              </div>
              <div className="av-preview-info">
                <span className="av-preview-label">Tu personaje</span>
                <span className="av-preview-name">{avatar.label}</span>
              </div>
            </div>

            <button className="lb-next-btn" onClick={() => setStep(2)}>
              Continuar con {avatar.label} →
            </button>
          </div>
        )}

        {/* ── PASO 2 ── */}
        {step === 2 && (
          <div className="lb-step-content">

            {/* Volver al avatar */}
            <button className="lb-back-avatar" onClick={() => setStep(1)}>
              <span className="lb-back-av-icon">{avatar.icon}</span>
              <span className="lb-back-av-name">{avatar.label}</span>
              <span className="lb-back-av-change">cambiar ↩</span>
            </button>

            {/* Nombre */}
            <p className="lb-step-title">
              {tab === 'create' ? '¿Cómo querés que te llamen?' : '¿Cuál es tu nombre?'}
            </p>
            <div className="lb-input-wrap">
              <span className="lb-input-icon">✎</span>
              <input
                className="lb-input-new"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre o alias..."
                maxLength={20}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && go()}
              />
              {name && (
                <span className="lb-input-clear" onClick={() => setName('')}>✕</span>
              )}
            </div>

            {/* ── SOLO CREATE: Modo de estimación ── */}
            {tab === 'create' && (
              <>
                <p className="lb-step-title">Modo de estimación</p>
                <div className="lb-card-mode">
                  {CARD_MODES.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      className={`lb-mode-btn ${cardMode === m.value ? 'active' : ''}`}
                      onClick={() => setCardMode(m.value)}
                    >
                      <span className="lb-mode-icon">{m.icon}</span>
                      <span className="lb-mode-label">{m.label}</span>
                      <span className="lb-mode-desc">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── SOLO JOIN: Código + Espectador ── */}
            {tab === 'join' && (
              <>
                {/* Código */}
                <p className="lb-step-title">Código de sala</p>
                <div className="lb-input-wrap">
                  <span className="lb-input-icon">⌗</span>
                  <input
                    className="lb-input-new lb-code-new"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                    placeholder="ej: AB3XY"
                    maxLength={5}
                    onKeyDown={e => e.key === 'Enter' && go()}
                  />
                </div>

                {/* ── TOGGLE ESPECTADOR ── */}
                {/* FIX: título siempre visible */}
                <p className="lb-step-title">¿Cómo querés participar?</p>

                <button
                  type="button"
                  className={`lb-spectator-toggle ${isSpectator ? 'active' : ''}`}
                  onClick={() => setIsSpectator(s => !s)}
                >
                  <span className="lb-spectator-icon">
                    {isSpectator ? '👁' : '🃏'}
                  </span>
                  <div className="lb-spectator-info">
                    <span className="lb-spectator-label">
                      {isSpectator ? 'Modo espectador' : 'Modo jugador'}
                    </span>
                    <span className="lb-spectator-desc">
                      {isSpectator
                        ? 'Solo observás, no votás'
                        : 'Participás en las votaciones'
                      }
                    </span>
                  </div>
                  <div className="lb-toggle-switch">
                    <div className="lb-toggle-knob"/>
                  </div>
                </button>
              </>
            )}

            {/* Error */}
            {err && (
              <div className="lb-err-new">
                <span>⚠</span> {err}
              </div>
            )}

            {/* Submit */}
            <button
              className="lb-submit-new"
              onClick={go}
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <span className="lb-loading">
                  <span className="lb-spinner"/>
                  Conectando…
                </span>
              ) : tab === 'create'
                ? <><span>✦</span> Crear sala</>
                : isSpectator
                  ? <><span>👁</span> Unirse como espectador</>
                  : <><span>⇢</span> Unirse a la sala</>
              }
            </button>

            <p className="lb-hint">
              🔒 Tu sesión se guarda automáticamente,<br/>
              si recargás la página volvés a tu sala
            </p>
          </div>
        )}
      </div>

      <footer className="lb-footer">
        <p className="lb-footer-copy">
          © {new Date().getFullYear()} CLA021POKER
        </p>
        <a
          href="https://cafecito.app/artiedalorena"
          target="_blank"
          rel="noopener noreferrer"
          className="lb-donate-btn"
        >
          ☕ Invitame un café
        </a>
      </footer>
    </div>
  )
}