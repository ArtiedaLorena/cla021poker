import { useMemo } from 'react'

const VW = 900
const VH = 540
const CX = VW / 2
const CY = VH / 2

// Avatar colors — cycling palette matching screenshot
const AV_COLORS = [
  '#e74c8b','#e67e22','#27ae60','#8e44ad','#2980b9',
  '#e74c3c','#16a085','#f39c12','#2c3e50','#1abc9c',
  '#9b59b6','#3498db','#e91e63','#ff5722','#607d8b',
  '#795548','#009688','#673ab7','#ff9800','#4caf50',
]

function getColor(idx) {
  return AV_COLORS[idx % AV_COLORS.length]
}

function usePositions(count) {
  return useMemo(() => {
    if (!count) return []
    // Ellipse ring where avatars sit ON the table edge
    const rx = 290
    const ry = 188
    return Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i / count) - Math.PI / 2
      return {
        x: CX + rx * Math.cos(angle),
        y: CY + ry * Math.sin(angle),
        angle,
      }
    })
  }, [count])
}

export default function PokerTable({
  participants, votesMap, revealed, myKey,
  facilitatorKey, onTransfer, currentStory, avg, allAgreed,
  votedCount, totalCount
}) {
  const positions = usePositions(participants.length)
  const AV = 52  // avatar box size

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <radialGradient id="feltG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2d6a2d"/>
          <stop offset="70%" stopColor="#1e4d1e"/>
          <stop offset="100%" stopColor="#0e2e0e"/>
        </radialGradient>
        <radialGradient id="feltGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#4caf5030" stopOpacity="1"/>
          <stop offset="100%" stopColor="#0e2e0e" stopOpacity="0"/>
        </radialGradient>
        <filter id="avShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.6"/>
        </filter>
        <filter id="tableShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="12" stdDeviation="24" floodColor="#000" floodOpacity="0.8"/>
        </filter>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Table shadow */}
      <ellipse cx={CX} cy={CY + 16} rx={340} ry={220} fill="rgba(0,0,0,0.55)" filter="url(#tableShadow)"/>
      {/* Wood rim */}
      <ellipse cx={CX} cy={CY} rx={335} ry={215} fill="#3d2b0a"/>
      <ellipse cx={CX} cy={CY} rx={325} ry={205} fill="#5a3e10"/>
      {/* Felt */}
      <ellipse cx={CX} cy={CY} rx={310} ry={190} fill="url(#feltG)"/>
      <ellipse cx={CX} cy={CY} rx={310} ry={190} fill="url(#feltGlow)"/>
      {/* Felt inner line */}
      <ellipse cx={CX} cy={CY} rx={295} ry={175} fill="none" stroke="#ffffff08" strokeWidth="1.5"/>

      {/* Center content */}
      {avg && revealed ? (
        <g>
          <rect x={CX-110} y={CY-50} width={220} height={100} rx="14"
            fill="rgba(0,0,0,0.55)" stroke="#ffffff12" strokeWidth="1"/>
          <text x={CX} y={CY-18} textAnchor="middle" fontSize="52" fontWeight="800"
            fontFamily="'JetBrains Mono',monospace"
            fill={allAgreed ? '#fbbf24' : '#6ee7b7'} filter="url(#glow)">{avg}</text>
          <text x={CX} y={CY+32} textAnchor="middle" fontSize="12"
            fontFamily="'Syne',sans-serif" letterSpacing="3"
            fill={allAgreed ? '#fbbf2490' : '#6ee7b790'}>
            {allAgreed ? 'CONSENSO ✓' : 'PROMEDIO'}
          </text>
        </g>
      ) : currentStory ? (
        /* Card matching screenshot: dark rounded box, label + story + vote count */
        <g>
          <rect x={CX-145} y={CY-52} width={290} height={104} rx="14"
            fill="rgba(5,8,16,0.72)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>
          {/* "Historia actual" label */}
          <text x={CX} y={CY-26} textAnchor="middle" fontSize="10"
            fontFamily="'Syne',sans-serif" fill="rgba(255,255,255,0.4)" letterSpacing="2">
            Historia actual
          </text>
          {/* Story name */}
          <text x={CX} y={CY+4} textAnchor="middle" fontSize="16" fontWeight="700"
            fontFamily="'Syne',sans-serif" fill="#e8edf8">
            {currentStory.length > 26 ? currentStory.slice(0,25)+'…' : currentStory}
          </text>
          {/* Vote progress — icon + count */}
          <text x={CX - 38} y={CY+34} textAnchor="middle" fontSize="14" fill="#6ee7b7">👤</text>
          <text x={CX + 10} y={CY+34} textAnchor="middle" fontSize="13"
            fontFamily="'Syne',sans-serif" fontWeight="600" fill="#6ee7b7">
            {`${votedCount}/${totalCount}`}
          </text>
          <text x={CX + 52} y={CY+34} textAnchor="middle" fontSize="12"
            fontFamily="'Syne',sans-serif" fill="rgba(110,231,183,0.6)">
            votaron
          </text>
        </g>
      ) : (
        <text x={CX} y={CY+6} textAnchor="middle" fontSize="16"
          fontFamily="'Syne',sans-serif" fill="#ffffff20" letterSpacing="6">CLA021POKER</text>
      )}

      {/* Players */}
      {participants.map((p, i) => {
        const pos   = positions[i]
        if (!pos) return null
        const uid   = p.user_key
        const voted = votesMap[uid] !== undefined
        const isMe  = uid === myKey
        const isFac = uid === facilitatorKey
        const val   = votesMap[uid]
        const color = getColor(i)
        const half  = AV / 2

        return (
          <g key={uid}>
            {/* Avatar box */}
            <g filter="url(#avShadow)">
              <rect
                x={pos.x - half} y={pos.y - half}
                width={AV} height={AV} rx="14"
                fill={color}
                stroke={isMe ? '#ffffff' : isFac ? '#fbbf24' : 'transparent'}
                strokeWidth={isMe || isFac ? 3 : 0}
              />
              {/* Voted checkmark overlay */}
              {voted && !revealed && (
                <rect x={pos.x - half} y={pos.y - half} width={AV} height={AV} rx="14"
                  fill="rgba(0,0,0,0.35)"/>
              )}
              <text x={pos.x} y={pos.y + 9} textAnchor="middle" fontSize="24">{p.avatar}</text>
              {/* Voted tick */}
              {voted && !revealed && (
                <text x={pos.x + half - 10} y={pos.y - half + 16} textAnchor="middle" fontSize="14" fill="#6ee7b7">✓</text>
              )}
              {/* Revealed vote badge */}
              {revealed && voted && (
                <g>
                  <rect x={pos.x + half - 18} y={pos.y - half - 4} width={28} height={22} rx="6"
                    fill="#131620" stroke="#6ee7b7" strokeWidth="1.5"/>
                  <text x={pos.x + half - 4} y={pos.y - half + 13} textAnchor="middle"
                    fontSize="12" fontWeight="800" fontFamily="'JetBrains Mono',monospace" fill="#6ee7b7">
                    {val}
                  </text>
                </g>
              )}
            </g>

            {/* Facilitator crown */}
            {isFac && (
              <text x={pos.x} y={pos.y - half - 4} textAnchor="middle" fontSize="16">👑</text>
            )}

            {/* Name label */}
            <text x={pos.x} y={pos.y + half + 18} textAnchor="middle"
              fontSize="13" fontWeight="700" fontFamily="'Syne',sans-serif"
              fill={isMe ? '#ffffff' : '#dde4f5'}
              stroke="rgba(0,0,0,0.8)" strokeWidth="4" paintOrder="stroke">
              {isMe ? `${p.name.slice(0,10)} (tú)` : p.name.slice(0,12)}
            </text>

            {/* Transfer button */}
            {myKey === facilitatorKey && uid !== facilitatorKey && (
              <g style={{ cursor:'pointer' }} onClick={() => onTransfer(uid)}>
                <circle cx={pos.x - half + 10} cy={pos.y - half + 10} r="12"
                  fill="rgba(0,0,0,0.7)" stroke="#fbbf24" strokeWidth="1.5"/>
                <text x={pos.x - half + 10} y={pos.y - half + 16}
                  textAnchor="middle" fontSize="12">👑</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}