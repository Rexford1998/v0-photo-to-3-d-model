"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

interface VoicePlayer {
  id: string
  nickname: string
  country: string
}

type VoiceSignalPayload =
  | {
      fromId: string
      toId: string
      type: "offer"
      sdp: RTCSessionDescriptionInit
    }
  | {
      fromId: string
      toId: string
      type: "answer"
      sdp: RTCSessionDescriptionInit
    }
  | {
      fromId: string
      toId: string
      type: "ice"
      candidate: RTCIceCandidateInit
    }
  | {
      fromId: string
      toId: string
      type: "leave"
    }

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
}

export function useVoiceChat({
  localPlayerId,
  players,
  country,
}: {
  localPlayerId: string | null
  players: VoicePlayer[]
  country: string
}) {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([])
  const [localAudioLevel, setLocalAudioLevel] = useState(0)
  const [speakingPeerIds, setSpeakingPeerIds] = useState<string[]>([])

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserCleanupRef = useRef<(() => void) | null>(null)
  const subscribedRef = useRef(false)

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {
        // ignore resume failures caused by browser autoplay policies
      })
    }

    return audioContextRef.current
  }, [])

  const cleanupAnalyser = useCallback(() => {
    analyserCleanupRef.current?.()
    analyserCleanupRef.current = null
    setLocalAudioLevel(0)
    setSpeakingPeerIds([])
  }, [])

  const startAudioMeters = useCallback(() => {
    cleanupAnalyser()

    let frameId = 0
    let cancelled = false

    const context = ensureAudioContext()
    const localStream = localStreamRef.current

    if (!context || !localStream) {
      return
    }

    const localAnalyser = context.createAnalyser()
    localAnalyser.fftSize = 512
    localAnalyser.smoothingTimeConstant = 0.75
    const localSource = context.createMediaStreamSource(localStream)
    localSource.connect(localAnalyser)
    const localBuffer = new Uint8Array(localAnalyser.frequencyBinCount)

    const remoteAnalysers = new Map<string, { analyser: AnalyserNode; buffer: Uint8Array; source: MediaStreamAudioSourceNode }>()

    remoteStreamsRef.current.forEach((stream, peerId) => {
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      const source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      remoteAnalysers.set(peerId, {
        analyser,
        buffer: new Uint8Array(analyser.frequencyBinCount),
        source,
      })
    })

    const sampleLevel = (buffer: Uint8Array) => {
      let total = 0
      for (let i = 0; i < buffer.length; i++) {
        total += buffer[i]
      }
      return total / buffer.length / 255
    }

    const tick = () => {
      if (cancelled) return

      localAnalyser.getByteFrequencyData(localBuffer)
      const nextLocalLevel = sampleLevel(localBuffer)
      setLocalAudioLevel(nextLocalLevel)

      const nextSpeakingPeerIds: string[] = []
      remoteAnalysers.forEach(({ analyser, buffer }, peerId) => {
        analyser.getByteFrequencyData(buffer)
        if (sampleLevel(buffer) > 0.08) {
          nextSpeakingPeerIds.push(peerId)
        }
      })
      setSpeakingPeerIds(nextSpeakingPeerIds)

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    analyserCleanupRef.current = () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
      localSource.disconnect()
      remoteAnalysers.forEach(({ source }) => source.disconnect())
    }
  }, [cleanupAnalyser, ensureAudioContext])

  const sendSignal = useCallback(async (payload: VoiceSignalPayload) => {
    const channel = channelRef.current
    if (!channel) return

    await channel.send({
      type: "broadcast",
      event: "signal",
      payload,
    })
  }, [])

  const updateConnectedPeers = useCallback(() => {
    const connectedIds: string[] = []
    peerConnectionsRef.current.forEach((connection, peerId) => {
      if (connection.connectionState === "connected") {
        connectedIds.push(peerId)
      }
    })
    setConnectedPeerIds(connectedIds)
  }, [])

  const cleanupPeer = useCallback(
    (peerId: string) => {
      const connection = peerConnectionsRef.current.get(peerId)
      if (connection) {
        connection.onicecandidate = null
        connection.ontrack = null
        connection.onconnectionstatechange = null
        connection.close()
        peerConnectionsRef.current.delete(peerId)
      }

      const audio = remoteAudioElementsRef.current.get(peerId)
      if (audio) {
        audio.pause()
        audio.srcObject = null
        remoteAudioElementsRef.current.delete(peerId)
      }

      remoteStreamsRef.current.delete(peerId)

      pendingIceCandidatesRef.current.delete(peerId)
      updateConnectedPeers()
      startAudioMeters()
    },
    [startAudioMeters, updateConnectedPeers]
  )

  const ensurePeerConnection = useCallback(
    (peerId: string) => {
      const existing = peerConnectionsRef.current.get(peerId)
      if (existing) {
        return existing
      }

      const connection = new RTCPeerConnection(rtcConfiguration)

      connection.onicecandidate = (event) => {
        if (!event.candidate || !localPlayerId) return

        sendSignal({
          fromId: localPlayerId,
          toId: peerId,
          type: "ice",
          candidate: event.candidate.toJSON(),
        }).catch((error) => {
          console.error("[voice] Failed to send ICE candidate:", error)
        })
      }

      connection.ontrack = (event) => {
        let audio = remoteAudioElementsRef.current.get(peerId)
        if (!audio) {
          audio = new Audio()
          audio.autoplay = true
          audio.playsInline = true
          audio.crossOrigin = "anonymous"
          remoteAudioElementsRef.current.set(peerId, audio)
        }
        audio.srcObject = event.streams[0]
        remoteStreamsRef.current.set(peerId, event.streams[0])
        audio.play().catch((error) => {
          console.warn("[voice] Remote audio playback was blocked:", error)
        })
        startAudioMeters()
      }

      connection.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(connection.connectionState)) {
          cleanupPeer(peerId)
          return
        }

        updateConnectedPeers()
      }

      const localStream = localStreamRef.current
      if (localStream) {
        const senders = connection.getSenders()
        localStream.getTracks().forEach((track) => {
          const alreadyAdded = senders.some((sender) => sender.track?.id === track.id)
          if (!alreadyAdded) {
            connection.addTrack(track, localStream)
          }
        })
      }

      peerConnectionsRef.current.set(peerId, connection)
      return connection
    },
    [cleanupPeer, localPlayerId, sendSignal, startAudioMeters, updateConnectedPeers]
  )

  const flushPendingIceCandidates = useCallback(async (peerId: string) => {
    const connection = peerConnectionsRef.current.get(peerId)
    const pending = pendingIceCandidatesRef.current.get(peerId)

    if (!connection || !pending?.length || !connection.remoteDescription) return

    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(candidate)
      } catch (error) {
        console.error("[voice] Failed to add queued ICE candidate:", error)
      }
    }

    pendingIceCandidatesRef.current.delete(peerId)
  }, [])

  const createOfferForPeer = useCallback(
    async (peerId: string) => {
      if (!localPlayerId) return

      const connection = ensurePeerConnection(peerId)
      if (connection.signalingState !== "stable") return

      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)

      await sendSignal({
        fromId: localPlayerId,
        toId: peerId,
        type: "offer",
        sdp: offer,
      })
    },
    [ensurePeerConnection, localPlayerId, sendSignal]
  )

  const disableVoice = useCallback(async () => {
    if (localPlayerId) {
      await Promise.allSettled(
        Array.from(peerConnectionsRef.current.keys()).map((peerId) =>
          sendSignal({ fromId: localPlayerId, toId: peerId, type: "leave" })
        )
      )
    }

    channelRef.current?.unsubscribe()
    channelRef.current = null
    subscribedRef.current = false

    peerConnectionsRef.current.forEach((_, peerId) => {
      cleanupPeer(peerId)
    })

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    remoteStreamsRef.current.clear()
    cleanupAnalyser()

    setConnectedPeerIds([])
    setIsVoiceEnabled(false)
    setIsMicMuted(false)
  }, [cleanupAnalyser, cleanupPeer, localPlayerId, sendSignal])

  const enableVoice = useCallback(async () => {
    if (!localPlayerId) {
      setVoiceError("Join the world before enabling voice chat.")
      return
    }

    try {
      setVoiceError(null)

      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        })
      }

      ensureAudioContext()
      startAudioMeters()

      const channel = supabase
        .channel(`voice-${country}`)
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          const signal = payload as VoiceSignalPayload

          if (!localPlayerId || signal.fromId === localPlayerId || signal.toId !== localPlayerId) {
            return
          }

          try {
            if (signal.type === "leave") {
              cleanupPeer(signal.fromId)
              return
            }

            const connection = ensurePeerConnection(signal.fromId)

            if (signal.type === "offer") {
              await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
              await flushPendingIceCandidates(signal.fromId)

              const answer = await connection.createAnswer()
              await connection.setLocalDescription(answer)

              await sendSignal({
                fromId: localPlayerId,
                toId: signal.fromId,
                type: "answer",
                sdp: answer,
              })
              return
            }

            if (signal.type === "answer") {
              await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
              await flushPendingIceCandidates(signal.fromId)
              return
            }

            if (signal.type === "ice") {
              if (connection.remoteDescription) {
                await connection.addIceCandidate(signal.candidate)
              } else {
                const pending = pendingIceCandidatesRef.current.get(signal.fromId) || []
                pending.push(signal.candidate)
                pendingIceCandidatesRef.current.set(signal.fromId, pending)
              }
            }
          } catch (error) {
            console.error("[voice] Signal handling failed:", error)
          }
        })

      channelRef.current = channel

      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            subscribedRef.current = true
            resolve()
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error("Failed to connect to voice signaling"))
          }
        })
      })

      setIsVoiceEnabled(true)
      setIsMicMuted(false)
    } catch (error) {
      console.error("[voice] Failed to enable voice:", error)
      setVoiceError(error instanceof Error ? error.message : "Microphone permission was denied.")
      await disableVoice()
    }
  }, [cleanupPeer, country, disableVoice, ensureAudioContext, ensurePeerConnection, flushPendingIceCandidates, localPlayerId, sendSignal, startAudioMeters])

  const toggleVoice = useCallback(async () => {
    if (isVoiceEnabled) {
      await disableVoice()
      return
    }

    await enableVoice()
  }, [disableVoice, enableVoice, isVoiceEnabled])

  const toggleMicMute = useCallback(() => {
    const nextMuted = !isMicMuted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setIsMicMuted(nextMuted)
  }, [isMicMuted])

  const activeRemotePlayers = useMemo(
    () => players.filter((player) => player.id !== localPlayerId),
    [localPlayerId, players]
  )

  useEffect(() => {
    if (!isVoiceEnabled || !localPlayerId || !subscribedRef.current) return

    for (const player of activeRemotePlayers) {
      if (localPlayerId < player.id && !peerConnectionsRef.current.has(player.id)) {
        createOfferForPeer(player.id).catch((error) => {
          console.error("[voice] Failed to create offer:", error)
        })
      }
    }

    const activeIds = new Set(activeRemotePlayers.map((player) => player.id))
    peerConnectionsRef.current.forEach((_, peerId) => {
      if (!activeIds.has(peerId)) {
        cleanupPeer(peerId)
      }
    })
  }, [activeRemotePlayers, cleanupPeer, createOfferForPeer, isVoiceEnabled, localPlayerId])

  useEffect(() => {
    return () => {
      disableVoice().catch(() => {
        // ignore cleanup failures during unmount
      })
    }
  }, [disableVoice])

  return {
    isVoiceEnabled,
    isMicMuted,
    voiceError,
    connectedPeerCount: connectedPeerIds.length,
    localAudioLevel,
    isLocalSpeaking: !isMicMuted && localAudioLevel > 0.08,
    speakingPeerIds,
    toggleVoice,
    toggleMicMute,
  }
}
