import { supabase } from './supabase.js'

const generateCode = () =>
  Math.random().toString(36).substring(2, 7).toUpperCase()

// ── Rooms ─────────────────────────────────────────────────────────────────

export async function createRoom(userKey) {
  const code = generateCode()
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code,
      revealed: false,
      current_story: '',
      facilitator_id: userKey,
      timer_started_at: null,
      timer_duration: 60,
      timer_running: false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// FIX #3 — Propagar error de red en lugar de tragarlo silenciosamente
export async function getRoom(code) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle() // maybeSingle no lanza error si no encuentra, single sí
  if (error) throw error
  return data || null
}

// ── Participants ──────────────────────────────────────────────────────────

export async function joinRoom(roomId, userKey, name, avatar) {
  const { error } = await supabase
    .from('participants')
    .upsert(
      { room_id: roomId, user_key: userKey, name, avatar, is_online: true },
      { onConflict: 'room_id,user_key' }
    )
  if (error) throw error

  await supabase
    .from('rooms')
    .update({ facilitator_id: userKey })
    .eq('id', roomId)
    .is('facilitator_id', null)
}

export async function markOffline(roomId, userKey) {
  await supabase
    .from('participants')
    .update({ is_online: false })
    .eq('room_id', roomId)
    .eq('user_key', userKey)
}

export async function leaveRoom(roomId, userKey) {
  // FIX #14 — Marcar offline primero pero NO borrar voto hasta después
  // del chequeo de facilitador, para no perder datos de rondas en curso
  await markOffline(roomId, userKey)

  const { data: room } = await supabase
    .from('rooms')
    .select('facilitator_id, revealed')
    .eq('id', roomId)
    .single()

  // Solo borrar voto si la ronda ya fue revelada o no hay historia activa
  // Si hay votación en curso, preservar el voto para el historial
  if (room?.revealed !== false) {
    await supabase
      .from('votes')
      .delete()
      .eq('room_id', roomId)
      .eq('user_key', userKey)
  }

  if (room?.facilitator_id === userKey) {
    const { data: next } = await supabase
      .from('participants')
      .select('user_key')
      .eq('room_id', roomId)
      .eq('is_online', true)
      .neq('user_key', userKey)
      .order('joined_at')
      .limit(1)
      .maybeSingle()

    await supabase
      .from('rooms')
      .update({ facilitator_id: next?.user_key ?? null })
      .eq('id', roomId)
  }
}

export async function kickParticipant(roomId, userKey) {
  await supabase
    .from('votes')
    .delete()
    .eq('room_id', roomId)
    .eq('user_key', userKey)

  // FIX #7 — Usar campo dedicado 'kicked_at' o un campo is_kicked separado
  // para distinguir kick de salida voluntaria.
  // Por ahora usamos is_online=false + kicked_at timestamp como señal
  const { error } = await supabase
    .from('participants')
    .update({ is_online: false, kicked_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_key', userKey)

  if (error) throw error
}

export async function getParticipants(roomId) {
  const { data } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_online', true)
    .order('joined_at')
  return data || []
}

export async function transferFacilitator(roomId, toKey) {
  const { error } = await supabase
    .from('rooms')
    .update({ facilitator_id: toKey })
    .eq('id', roomId)
  if (error) throw error
}

// ── Voting ────────────────────────────────────────────────────────────────

export async function castVote(roomId, userKey, value) {
  const { error } = await supabase
    .from('votes')
    .upsert(
      { room_id: roomId, user_key: userKey, value },
      { onConflict: 'room_id,user_key' }
    )
  if (error) throw error
}

export async function getVotes(roomId) {
  const { data } = await supabase
    .from('votes')
    .select('*')
    .eq('room_id', roomId)
  return data || []
}

// ── Round control ─────────────────────────────────────────────────────────

export async function setStory(roomId, story) {
  await supabase.from('votes').delete().eq('room_id', roomId)
  const { error } = await supabase
    .from('rooms')
    .update({
      current_story: story,
      revealed: false,
      updated_at: new Date().toISOString(),
      timer_running: false,
      timer_started_at: null,
    })
    .eq('id', roomId)
  if (error) throw error
}

// FIX #6 — Guard de idempotencia: verificar si ya está revelado antes de insertar ronda
export async function revealVotes(roomId) {
  const [{ data: room }, votes, participants] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    getVotes(roomId),
    getParticipants(roomId),
  ])

  // Guard: si ya está revelado, no insertar ronda duplicada
  if (room?.revealed) return

  const numVals = votes
    .filter(v => v.value !== '?' && v.value !== '☕')
    .map(v => v.value === '½' ? 0.5 : Number(v.value))

  const avg = numVals.length
    ? (numVals.reduce((a, b) => a + b, 0) / numVals.length).toFixed(1)
    : '?'

  const votesSnapshot        = Object.fromEntries(votes.map(v => [v.user_key, v.value]))
  const participantsSnapshot = Object.fromEntries(
    participants.map(p => [p.user_key, { name: p.name, avatar: p.avatar }])
  )

  const { error } = await supabase
    .from('rooms')
    .update({
      revealed: true,
      updated_at: new Date().toISOString(),
      timer_running: false,
    })
    .eq('id', roomId)
  if (error) throw error

  if (room?.current_story && votes.length > 0) {
    await supabase.from('rounds').insert({
      room_id: roomId,
      story: room.current_story,
      votes_snapshot: votesSnapshot,
      participants_snapshot: participantsSnapshot,
      average: avg,
    })
  }
}

export async function resetRound(roomId) {
  await supabase.from('votes').delete().eq('room_id', roomId)
  const { error } = await supabase
    .from('rooms')
    .update({
      revealed: false,
      current_story: '',
      updated_at: new Date().toISOString(),
      timer_running: false,
      timer_started_at: null,
      timer_duration: 60,
    })
    .eq('id', roomId)
  if (error) throw error
}

export async function startTimer(roomId, duration) {
  const { error } = await supabase
    .from('rooms')
    .update({
      timer_running: true,
      timer_duration: duration,
      timer_started_at: new Date().toISOString(),
    })
    .eq('id', roomId)
  if (error) throw error
}

export async function stopTimer(roomId) {
  const { error } = await supabase
    .from('rooms')
    .update({
      timer_running: false,
      timer_started_at: null,
    })
    .eq('id', roomId)
  if (error) throw error
}

export async function updateTimerDuration(roomId, duration) {
  const { error } = await supabase
    .from('rooms')
    .update({ timer_duration: duration })
    .eq('id', roomId)
  if (error) throw error
}

// ── History ───────────────────────────────────────────────────────────────

export async function getRounds(roomId) {
  const { data } = await supabase
    .from('rounds')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
  return data || []
}