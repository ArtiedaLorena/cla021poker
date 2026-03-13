import { supabase } from './supabase.js'

// FIX #6 — Verificar unicidad del código antes de usarlo
async function generateUniqueCode() {
  const MAX_ATTEMPTS = 10
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase()
    const { data } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('No se pudo generar un código único. Intentá de nuevo.')
}

// ── Rooms ─────────────────────────────────────────────────────────────────

export async function createRoom(userKey) {
  const code = await generateUniqueCode()
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

export async function getRoom(code) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle()
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
  await markOffline(roomId, userKey)

  const { data: room } = await supabase
    .from('rooms')
    .select('facilitator_id, revealed')
    .eq('id', roomId)
    .single()

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

// FIX #4 — Traer TODOS los participantes para el snapshot (no solo online)
export async function revealVotes(roomId) {
  const [{ data: room }, votes] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    getVotes(roomId),
  ])

  if (room?.revealed) return

  const { data: allParticipants } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)

  const numVals = votes
    .filter(v => v.value !== '?' && v.value !== '☕')
    .map(v => v.value === '½' ? 0.5 : Number(v.value))

  const avg = numVals.length
    ? (numVals.reduce((a, b) => a + b, 0) / numVals.length).toFixed(1)
    : '?'

  const votesSnapshot = Object.fromEntries(votes.map(v => [v.user_key, v.value]))
  const participantsSnapshot = Object.fromEntries(
    (allParticipants || []).map(p => [p.user_key, { name: p.name, avatar: p.avatar }])
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