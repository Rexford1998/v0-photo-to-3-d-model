import { useEffect, useState, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useMultiplayerWorld() {
  const [players, setPlayers] = useState<any[]>([])
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [localPlayer, setLocalPlayer] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Subscribe to realtime updates
  useEffect(() => {
    if (!localPlayer) return

    // Players subscription
    const playersChannel = supabase
      .channel(`players-${localPlayer.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        payload => {
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

    // Chat subscription
    const chatChannel = supabase
      .channel(`chat-${localPlayer.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          setChatMessages(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      playersChannel.unsubscribe()
      chatChannel.unsubscribe()
    }
  }, [localPlayer])

  const joinWorld = useCallback(
    async (nickname: string) => {
      try {
        const { data, error } = await supabase
          .from("players")
          .insert([
            {
              nickname,
              position_x: Math.random() * 20 - 10,
              position_y: 0,
              position_z: Math.random() * 20 - 10,
              rotation_y: 0,
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
            }
          ])
          .select()
          .single()

        if (error) throw error
        setLocalPlayer(data)
        setIsConnected(true)

        // Load all players
        const { data: allPlayers } = await supabase.from("players").select("*")
        setPlayers(allPlayers || [])

        // Load recent chat
        const { data: recentChat } = await supabase
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)

        setChatMessages((recentChat || []).reverse())
      } catch (err) {
        console.error("Failed to join world:", err)
      }
    },
    []
  )

  const updatePosition = useCallback(
    async (x: number, z: number, rotation: number) => {
      if (!localPlayer) return

      await supabase
        .from("players")
        .update({
          position_x: x,
          position_z: z,
          rotation_y: rotation,
          last_seen: new Date()
        })
        .eq("id", localPlayer.id)

      setLocalPlayer(prev => ({ ...prev, position_x: x, position_z: z, rotation_y: rotation }))
    },
    [localPlayer]
  )

  const sendMessage = useCallback(
    async (message: string) => {
      if (!localPlayer || !message.trim()) return

      await supabase.from("chat_messages").insert([
        {
          player_id: localPlayer.id,
          username: localPlayer.nickname,
          message
        }
      ])
    },
    [localPlayer]
  )

  const leaveWorld = useCallback(async () => {
    if (!localPlayer) return

    await supabase.from("players").delete().eq("id", localPlayer.id)
    setLocalPlayer(null)
    setIsConnected(false)
    setPlayers([])
    setChatMessages([])
  }, [localPlayer])

  return {
    players,
    chatMessages,
    localPlayer,
    isConnected,
    joinWorld,
    updatePosition,
    sendMessage,
    leaveWorld
  }
}
