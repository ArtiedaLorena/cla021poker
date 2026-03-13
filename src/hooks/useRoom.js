import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import * as svc from '../lib/roomService.js'

export function useRoom(roomId, userKey, onKicked) {
  const [room, setRoom]                 = useState(null)
  const [participants, setParticipants] = useState([])
  const [votes, setVotes]               = useState([])
  const [rounds, setRounds]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const channelRef                      = useRef(null)
  const kickChannelRef                  = useRef(null)
  const refreshingRef                   = useRef(false)

  const refresh = useCallback(async () => {
    if (!roomId) return
    if (refreshingRef.current) return
    refreshingRef.current = true
    try {
      const [roomData, parts, voteData, roundData] = await Promise.all([
        supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()
          .then(r => {
            if (r.error) throw r.error
            return r.data
          }),
        svc.getParticipants(roomId),
        svc.getVotes(roomId),
        svc.getRounds(roomId),
      ])
      setRoom(roomData)
      setParticipants(parts    ?? [])
      setVotes(voteData        ?? [])
      setRounds(roundData      ?? [])
    } catch (e) {
      console.error('useRoom/refresh error:', e)
      setError(e)
    } finally {
      setLoading(false)
      refreshingRef.current = false
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    refresh()

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms',        filter: `id=eq.${roomId}`      }, () => refresh())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, () => refresh())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes',        filter: `room_id=eq.${roomId}` }, () => refresh())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds',       filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed to room ${roomId}`)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Realtime error:', err)
          setTimeout(() => refresh(), 3000)
        }
      })

    // FIX #7 — Detectar kick por campo kicked_at en lugar de solo is_online=false
    // para no confundir salida voluntaria con kick
    const kickChannel = supabase
      .channel(`kick-${roomId}-${userKey}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (
            payload.new.user_key === userKey &&
            payload.new.is_online === false &&
            payload.new.kicked_at !== null &&  // FIX: solo si fue kickeado
            payload.new.kicked_at !== payload.old.kicked_at // FIX: es nuevo
          ) {
            onKicked?.()
          }
        }
      )
      .subscribe()

    channelRef.current     = channel
    kickChannelRef.current = kickChannel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(kickChannel)
    }
  }, [roomId, userKey, refresh, onKicked])

  const isFacilitator   = Boolean(room?.facilitator_id && room.facilitator_id === userKey)
  const votesMap        = useMemo(
    () => Object.fromEntries(votes.map(v => [v.user_key, v.value])),
    [votes]
  )
  const participantsMap = useMemo(
    () => Object.fromEntries(participants.map(p => [p.user_key, p])),
    [participants]
  )

  // FIX #15 — Filtrar solo votos de participantes activos para evitar votos huérfanos
  const activeUserKeys = useMemo(
    () => new Set(participants.map(p => p.user_key)),
    [participants]
  )

  const numVals = useMemo(() =>
    votes
      .filter(v => activeUserKeys.has(v.user_key))
      .filter(v => v.value !== '?' && v.value !== '☕')
      .map(v => v.value === '½' ? 0.5 : Number(v.value)),
    [votes, activeUserKeys]
  )

  const avg = useMemo(() =>
    numVals.length
      ? (numVals.reduce((a, b) => a + b, 0) / numVals.length).toFixed(1)
      : null,
    [numVals]
  )

  const allAgreed = useMemo(() =>
    new Set(numVals).size === 1 && numVals.length > 1,
    [numVals]
  )

  // FIX #5 — timerTimeLeft como useMemo en lugar de IIFE en render
  const timerTimeLeft = useMemo(() => {
    if (!room?.timer_running || !room?.timer_started_at) {
      return room?.timer_duration ?? 60
    }
    const elapsed = Math.floor(
      (Date.now() - new Date(room.timer_started_at).getTime()) / 1000
    )
    return Math.max(0, (room.timer_duration ?? 60) - elapsed)
  }, [room?.timer_running, room?.timer_started_at, room?.timer_duration])

  // FIX #15 — votedCount solo cuenta votos de participantes activos
  const activeVotedCount = useMemo(() =>
    votes.filter(v => activeUserKeys.has(v.user_key)).length,
    [votes, activeUserKeys]
  )

  return {
    room,
    participants,
    votes,
    votesMap,
    participantsMap,
    rounds,
    loading,
    error,
    isFacilitator,
    avg,
    allAgreed,
    refresh,
    votedCount:    activeVotedCount,
    totalCount:    participants.length,
    timerTimeLeft,
    timerRunning:  room?.timer_running   ?? false,
    timerDuration: room?.timer_duration  ?? 60,
  }
}
