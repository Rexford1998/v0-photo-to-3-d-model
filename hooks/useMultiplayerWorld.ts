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

  // Subscribe to realtime updates
  useEffect(() => {
    if (!playerId) return

    try {
      // Players subscription
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
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("[v0] Subscribed to players channel")
          }
        })

      // Chat subscription
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
    } catch (err) {
      console.error("[v0] Subscription error:", err)
      setError("Failed to connect to multiplayer")
    }
  }, [playerId])

  // Update online count whenever players change
  useEffect(() => {
    setOnlineCount(players.length)
  }, [players])

  const joinWorld = useCallback(
    async (nickname: string, color: string) => {
      try {
        setError(null)
        
        // Retry logic for schema cache issues
        let retries = 0
        let lastError: any = null
        
        while (retries < 3) {
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
            lastError = insertError
            // If it's a schema cache issue, retry
            if (insertError.code === 'PGRST205') {
              retries++
              if (retries < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retries))
                continue
              }
            }
            console.error("[v0] Insert error:", insertError)
            setError(`Failed to join: ${insertError.message}`)
            return false
          }

          setPlayerId(data.id)
          setIsConnected(true)

          // Load all players
          const { data: allPlayers, error: fetchError } = await supabase
            .from("players")
            .select("*")

          if (fetchError) {
            console.error("[v0] Fetch players error:", fetchError)
          } else {
            setPlayers(allPlayers || [])
          }

          // Load recent chat
          const { data: recentChat } = await supabase
            .from("chat_messages")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50)

          setChatMessages((recentChat || []).reverse())
          return true
        }
        
        // All retries failed
        setError(`Failed to join: ${lastError?.message || 'Database unavailable'}`)
        return false
      } catch (err) {
        console.error("[v0] Failed to join world:", err)
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
        const { error } = await supabase
          .from("players")
          .update({
            position_x: x,
            position_z: z,
            rotation_y: rotation,
            last_seen: new Date().toISOString()
          })
          .eq("id", playerId)

        if (error) console.error("[v0] Position update error:", error)
      } catch (err) {
        console.error("[v0] Failed to update position:", err)
      }
    },
    [playerId]
  )

  const sendMessage = useCallback(
    async (message: string, username: string) => {
      if (!playerId || !message.trim()) return

      try {
        const { error } = await supabase.from("chat_messages").insert([
          {
            player_id: playerId,
            username,
            message
          }
        ])

        if (error) console.error("[v0] Send message error:", error)
      } catch (err) {
        console.error("[v0] Failed to send message:", err)
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
      console.error("[v0] Failed to leave world:", err)
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
    sendMessage,
    leaveWorld
  }
}
