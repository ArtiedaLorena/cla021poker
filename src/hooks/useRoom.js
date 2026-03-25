import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import * as svc from '../lib/roomService.js'

export const CARD_MODES = {
  fibonacci: {
    label: 'Fibonacci',
    icon:  '🔢',
    cards: ['1', '2', '3', '5', '8', '13', '20', '☕'],
  },
  tshirt: {
    label:   'T-Shirt',
    icon:    '👕',
    cards:   ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
    weights: { XS: 1, S: 2, M: 3, L: 5, XL: 8, XXL: 13 },
  },
}

export function useRoom(roomId, userKey, onKicked) {
  const [room,         setRoom]         = useState(null)
  const [participants, setParticipants] = useState([])
  const [votes,        setVotes]        = useState([])
  const [rounds,       setRounds]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const channelRef     = useRef(null)
  const kickChannelRef = useRef(null)
  const refreshingRef  = useRef(false)
  const isMountedRef   = useRef(true)
  const onKickedRef    = useRef(onKicked)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  useEffect(() => {
    onKickedRef.current = onKicked
  }, [onKicked])

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

      if (!isMountedRef.current) return
      setRoom(roomData)
      setParticipants(parts    ?? [])
      setVotes(voteData        ?? [])
      setRounds(roundData      ?? [])
    } catch (e) {
      if (!isMountedRef.current) return
      setError(e)
    } finally {
      if (isMountedRef.current) setLoading(false)
      refreshingRef.current = false
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    refresh()

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && isMountedRef.current) {
            // FIX: setRoom directo + refresh para garantizar consistencia
            setRoom(payload.new)
          }
        }
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => refresh(), 3000)
        }
      })

    const kickChannel = supabase
      .channel(`kick-${roomId}-${userKey}`)
      .on('postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (
            payload.new.user_key  === userKey        &&
            payload.new.is_online === false           &&
            payload.new.kicked_at !== null            &&
            payload.new.kicked_at !== payload.old.kicked_at
          ) {
            onKickedRef.current?.()
          }
        }
      )
      .subscribe()

    channelRef.current     = channel
    kickChannelRef.current = kickChannel

    return () => {
      supabase.removeChannel(channel).catch(() => {})
      supabase.removeChannel(kickChannel).catch(() => {})
    }
  }, [roomId, userKey, refresh])

  const isFacilitator = Boolean(
    room?.facilitator_id && room.facilitator_id === userKey
  )

  // FIX: resolvedCardMode con doble fallback
  const rawCardMode      = room?.card_mode ?? 'fibonacci'
  const resolvedCardMode = CARD_MODES[rawCardMode] ? rawCardMode : 'fibonacci'

  const voters = useMemo(
    () => participants.filter(p => !p.is_spectator),
    [participants]
  )

  const spectators = useMemo(
    () => participants.filter(p => p.is_spectator),
    [participants]
  )

  const amISpectator = useMemo(
    () => participants.find(p => p.user_key === userKey)?.is_spectator ?? false,
    [participants, userKey]
  )

  const votesMap = useMemo(
    () => Object.fromEntries(votes.map(v => [v.user_key, v.value])),
    [votes]
  )

  const participantsMap = useMemo(
    () => Object.fromEntries(participants.map(p => [p.user_key, p])),
    [participants]
  )

  const activeVoterKeys = useMemo(
    () => new Set(voters.map(p => p.user_key)),
    [voters]
  )

  const { avg, allAgreed } = useMemo(() => {
    const activeVotes = votes.filter(v => activeVoterKeys.has(v.user_key))

    if (resolvedCardMode === 'tshirt') {
      const validVotes = activeVotes
        .filter(v => v.value !== '?' && v.value !== '☕')
        .map(v => v.value)

      if (!validVotes.length) return { avg: null, allAgreed: false }

      const freq = validVotes.reduce((acc, v) => {
        acc[v] = (acc[v] || 0) + 1
        return acc
      }, {})
      const maxFreq = Math.max(...Object.values(freq))
      const modes   = Object.entries(freq)
        .filter(([, f]) => f === maxFreq)
        .map(([v]) => v)

      return {
        avg:      modes.join(' / '),
        allAgreed: modes.length === 1 && validVotes.length > 1,
      }
    } else {
      const numVals = activeVotes
        .filter(v => v.value !== '?' && v.value !== '☕')
        .map(v => Number(v.value))

      if (!numVals.length) return { avg: null, allAgreed: false }

      return {
        avg:      (numVals.reduce((a, b) => a + b, 0) / numVals.length).toFixed(1),
        allAgreed: new Set(numVals).size === 1 && numVals.length > 1,
      }
    }
  }, [votes, activeVoterKeys, resolvedCardMode])

  const activeVotedCount = useMemo(
    () => votes.filter(v => activeVoterKeys.has(v.user_key)).length,
    [votes, activeVoterKeys]
  )

  return {
    room,
    participants,
    voters,
    spectators,
    votes,
    votesMap,
    participantsMap,
    rounds,
    loading,
    error,
    isFacilitator,
    amISpectator,
    cardMode:       resolvedCardMode,
    avg,
    allAgreed,
    refresh,
    votedCount:     activeVotedCount,
    totalCount:     voters.length,
    timerRunning:   room?.timer_running    ?? false,
    timerDuration:  room?.timer_duration   ?? 60,
    timerStartedAt: room?.timer_started_at ?? null,
  }
}