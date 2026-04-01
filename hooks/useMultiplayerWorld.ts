"use client"

/**
 * Multiplayer World Hook
 * Handles real-time player synchronization and chat via Supabase
 * Updated: Forces cache invalidation
 */
import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

interface Player {
  id: string
  nickname: string
  country: string
  model_url?: string
  animation_url?: string
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
  country: string
  username: string
  message: string
  created_at: string
}

export function useMultiplayerWorld(modelUrl: string = "", country: string = "United States") {
  const [players, setPlayers] = useState<Player[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)

  // Subscribe to realtime player updates
  useEffect(() => {
    if (!playerId) return

    const playersChannel = supabase
      .channel(`players-${playerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `country=eq.${encodeURIComponent(country)}` },
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
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `country=eq.${encodeURIComponent(country)}` },
        (payload: any) => {
          setChatMessages(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      playersChannel.unsubscribe()
      chatChannel.unsubscribe()
    }
  }, [playerId, country])

  // Update online count
  useEffect(() => {
    setOnlineCount(players.length)
  }, [players])

  const joinWorld = useCallback(
    async (nickname: string, color: string, country: string) => {
      try {
        setError(null)

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError("You must be logged in to join the world")
          return false
        }

        // Check if player for this user and country already exists
        const { data: existingPlayer } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .eq("country", country)
          .maybeSingle()

        let playerData
        
        if (existingPlayer) {
          // Update existing player record
          const { data, error: updateError } = await supabase
            .from("players")
            .update({
              nickname,
              model_url: modelUrl || existingPlayer.model_url,
              user_id: user.id,
              country,
              position_x: Math.random() * 20 - 10,
              position_y: 0,
              position_z: Math.random() * 20 - 10,
              rotation_y: 0,
              color,
              updated_at: new Date().toISOString()
            })
            .eq("id", existingPlayer.id)
            .select()
            .single()
          
          if (updateError) {
            console.error("[v0] Update error:", updateError)
            setError(`Failed to join: ${updateError.message}`)
            return false
          }
          playerData = data
        } else {
          // Insert new player record
          const { data, error: insertError } = await supabase
            .from("players")
            .insert([
              {
                nickname,
                user_id: user.id,
                country,
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
            console.error("[v0] Insert error:", insertError)
            setError(`Failed to join: ${insertError.message}`)
            return false
          }
          playerData = data
        }

        setPlayerId(playerData.id)
        setIsConnected(true)

        const { data: allPlayers } = await supabase
          .from("players")
          .select("*")
          .eq("country", country)
        setPlayers(allPlayers || [])

        const { data: recentChat } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("country", country)
          .order("created_at", { ascending: false })
          .limit(50)

        setChatMessages((recentChat || []).reverse())
        return true
      } catch (err) {
        console.error("[v0] Join error:", err)
        setError(err instanceof Error ? err.message : "Failed to join world")
        return false
      }
    },
    [modelUrl]
  )

  const updatePosition = useCallback(
    async (x: number, z: number, rotation: number) => {
      if (!playerId) return

      try {
        await supabase
          .from("players")
          .update({
            position_x: x,
            position_z: z,
            rotation_y: rotation,
            last_seen: new Date().toISOString()
          })
          .eq("id", playerId)
      } catch (err) {
        console.error("[v0] Position update error:", err)
      }
    },
    [playerId]
  )

  const sendMessage = useCallback(
    async (message: string, username: string, country: string) => {
      if (!playerId || !message.trim()) return

      try {
        await supabase.from("chat_messages").insert([
          {
            player_id: playerId,
            username,
            message,
            country
          }
        ])
      } catch (err) {
        console.error("[v0] Send message error:", err)
      }
    },
    [playerId]
  )

  const updateAnimation = useCallback(
    async (animationUrl: string | null) => {
      if (!playerId) return

      try {
        await supabase
          .from("players")
          .update({
            animation_url: animationUrl,
            updated_at: new Date().toISOString()
          })
          .eq("id", playerId)
      } catch (err) {
        console.error("[v0] Animation update error:", err)
      }
    },
    [playerId]
  )

  const leaveWorld = useCallback(async () => {
    if (!playerId) return

    try {
      await supabase.from("players").delete().eq("id", playerId)
      setPlayerId(null)
      setIsConnected(false)
      setPlayers([])
      setChatMessages([])
    } catch (err) {
      console.error("[v0] Leave error:", err)
    }
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
    updateAnimation,
    sendMessage,
    leaveWorld
  }
}
