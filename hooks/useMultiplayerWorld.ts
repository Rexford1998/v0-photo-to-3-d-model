"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

interface Player {
  id: string
  nickname: string
  model_url?: string
  position_x: number
  position_y: number
  position_z: number
  rotation_y: number
  color: string
  created_at: string
}

interface ChatMessage {
  id: string
  player_id: string
  username: string
  message: string
  created_at: string
}

export function useMultiplayerWorld(modelUrl: string = "") {
  const [players, setPlayers] = useState<Player[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!playerId) return

    const playersChannel = supabase
      .channel(`players-${playerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            setPlayers(prev => prev.filter(p => p.id !== payload.old.id))
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setPlayers(prev => {
              const idx = prev.findIndex(p => p.id === payload.new.id)
              if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = payload.new
                return updated
              }
              return [...prev, payload.new]
            })
          }
        }
      )
      .subscribe()

    const chatChannel = supabase
      .channel(`chat-${playerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          setChatMessages(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      playersChannel.unsubscribe()
      chatChannel.unsubscribe()
    }
  }, [playerId])

  useEffect(() => {
    setOnlineCount(players.length)
  }, [players])

  const joinWorld = useCallback(
    async (nickname: string, color: string) => {
      try {
        setError(null)

        const { data, error: insertError } = await supabase
          .from("players")
          .insert([
            {
              nickname,
              model_url: modelUrl || null,
              position_x: Math.random() * 20 - 10,
              position_y: 0,
              position_z: Math.random() * 20 - 10,
              rotation_y: 0,
              color
            }
          ])
          .select()
          .single()

        if (insertError) {
          setError(`Failed to join: ${insertError.message}`)
          return false
        }

        setPlayerId(data.id)
        setIsConnected(true)

        const { data: allPlayers } = await supabase.from("players").select("*")
        setPlayers(allPlayers || [])

        const { data: recentChat } = await supabase
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)

        setChatMessages((recentChat || []).reverse())
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join world")
        return false
      }
    },
    [modelUrl]
  )

  const updatePosition = useCallback(
    async (x: number, z: number, rotation: number) => {
      if (!playerId) return

      await supabase
        .from("players")
        .update({
          position_x: x,
          position_z: z,
          rotation_y: rotation,
          last_seen: new Date().toISOString()
        })
        .eq("id", playerId)
    },
    [playerId]
  )

  const sendMessage = useCallback(
    async (message: string, username: string) => {
      if (!playerId || !message.trim()) return

      await supabase.from("chat_messages").insert([
        {
          player_id: playerId,
          username,
          message
        }
      ])
    },
    [playerId]
  )

  const leaveWorld = useCallback(async () => {
    if (!playerId) return

    await supabase.from("players").delete().eq("id", playerId)
    setPlayerId(null)
    setIsConnected(false)
    setPlayers([])
    setChatMessages([])
  }, [playerId])

  return {
    playerId,
    players,
    chatMessages,
    isConnected,
    error,
    onlineCount,
    joinWorld,
    updatePosition,
    sendMessage,
    leaveWorld
  }
}
