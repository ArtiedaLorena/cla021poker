import { useState, useEffect, useCallback, useRef } from 'react'
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

    // Canal principal — cambios en sala, participantes, votos y rondas
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => refresh()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        () => refresh()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        () => refresh()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${roomId}` },
        () => refresh()
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed to room ${roomId}`)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Realtime error:`, err)
          setTimeout(() => refresh(), 3000)
        }
      })

    // Canal de kick — detecta si este usuario fue removido
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
            payload.new.is_online === false
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
  const votesMap        = Object.fromEntries(votes.map(v => [v.user_key, v.value]))
  const participantsMap = Object.fromEntries(participants.map(p => [p.user_key, p]))

  const numVals = votes
    .filter(v => v.value !== '?' && v.value !== '☕')
    .map(v => v.value === '½' ? 0.5 : Number(v.value))

  const avg       = numVals.length
    ? (numVals.reduce((a, b) => a + b, 0) / numVals.length).toFixed(1)
    : null
  const allAgreed = new Set(numVals).size === 1 && numVals.length > 1

  const timerTimeLeft = (() => {
    if (!room?.timer_running || !room?.timer_started_at) {
      return room?.timer_duration ?? 60
    }
    const elapsed = Math.floor(
      (Date.now() - new Date(room.timer_started_at).getTime()) / 1000
    )
    return Math.max(0, (room.timer_duration ?? 60) - elapsed)
  })()

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
    votedCount:    votes.length,
    totalCount:    participants.length,
    timerTimeLeft,
    timerRunning:  room?.timer_running   ?? false,
    timerDuration: room?.timer_duration  ?? 60,
  }
}

export function useTimer(onEnd) {
  const [remaining, setRemaining] = useState(60)
  const [running, setRunning]     = useState(false)
  const [total, setTotal]         = useState(60)
  const ref                       = useRef(null)

  const start = useCallback((d = 60) => {
    setTotal(d); setRemaining(d); setRunning(true)
  }, [])

  const stop = useCallback(() => {
    setRunning(false)
    clearInterval(ref.current)
  }, [])

  const reset = useCallback((d = 60) => {
    stop(); setTotal(d); setRemaining(d)
  }, [stop])

  useEffect(() => {
    if (!running) return
    ref.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(ref.current)
          setRunning(false)
          onEnd?.()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(ref.current)
  }, [running, onEnd])

  return { remaining, running, total, start, stop, reset }
}