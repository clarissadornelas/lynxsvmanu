import { useState, useRef, useEffect, useCallback } from 'react'
import Peer, { DataConnection, MediaConnection } from 'peerjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Copy,
  Video,
  PhoneOff,
  Radio,
  AlertTriangle,
  Loader2,
  Download,
  FileText,
  Sparkles,
  Clock,
  MessageSquare,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { getState } from '@/stores/useActiveContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Phase = 'gate' | 'connecting' | 'room' | 'ended'
type ConnState = 'idle' | 'connecting' | 'connected' | 'timeout' | 'error' | 'waiting'

interface TranscriptSegment {
  start: number
  text: string
  speaker: string
}

interface VagaOption {
  id: string
  titulo: string
  cargo: string | null
  empresa: string | null
}

interface CandidatoOption {
  id: string
  nome: string
  vaga_id: string | null
}

interface AnalysisResult {
  dry_run?: boolean
  disc: { profile: string; D: number; I: number; S: number; C: number; confidence: number } | null
  relatorio: {
    executive_summary: string
    description: string
    recommendation: string
    strengths: string[]
    risks: string[]
    next_steps: string
  } | null
  competencyMatch: Array<{ competency: string; match: number; evidence: string }>
  speechConsistency: { score: number; notes: string } | null
  score_simulado: number
  score_obs: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// TURN público gratuito (OpenRelay). Trocar por TURN próprio na fase de produção.
const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
}

const REC_STYLES: Record<string, string> = {
  Aprovado: 'bg-green-100 text-green-700 border-green-200',
  'Em Análise': 'bg-amber-100 text-amber-700 border-amber-200',
  Reprovado: 'bg-red-100 text-red-700 border-red-200',
}

const DISC_FACTORS = [
  { label: 'D - Dominância', key: 'D' as const, color: '#E63946' },
  { label: 'I - Influência', key: 'I' as const, color: '#F77F00' },
  { label: 'S - Estabilidade', key: 'S' as const, color: '#06A77D' },
  { label: 'C - Conformidade', key: 'C' as const, color: '#457B9D' },
]

const CONSENT_TEXT =
  '**Esta entrevista será gravada e transcrita** para apoiar a avaliação do processo seletivo. A gravação começa quando os dois estiverem na sala e termina quando a entrevista acabar. Ao entrar, você concorda com isso.'

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789'

const HOST_MAX_RETRIES = 5
const HOST_RETRY_INTERVAL = 3000
const GUEST_RETRY_INTERVAL = 4000
const GUEST_INITIAL_TIMEOUT = 5000

function generateRoomCode(): string {
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]
  }
  return 'lit-' + suffix
}

function deterministicHostId(codigo: string): string {
  return 'lynxs-bancada-' + codigo
}

function resolveTenantId(): string | null {
  const fromState = getState().tenantId
  if (fromState) return fromState
  try {
    const stored = localStorage.getItem('active-context')
    if (stored) return JSON.parse(stored)?.tenantId ?? null
  } catch {
    /* ignora */
  }
  return null
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

function renderConsent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function toBlob(data: unknown): Blob | null {
  if (data instanceof ArrayBuffer) {
    return new Blob([data])
  }
  if (data instanceof Blob) {
    return data
  }
  if (ArrayBuffer.isView(data)) {
    return new Blob([data as ArrayBufferView])
  }
  return null
}

async function transcribeTrack(
  blob: Blob,
  speaker: string,
  tenantId: string,
  token: string,
): Promise<{ segments: Array<{ start: number; text: string }>; duration?: number }> {
  const formData = new FormData()
  formData.append('file', blob, `${speaker}.webm`)
  formData.append('speaker', speaker)
  formData.append('tenantId', tenantId)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/lab-transcribe-audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error || err.detail || 'Falha na transcrição')
  }
  return res.json()
}

function mergeTranscripts(
  recSegs: Array<{ start?: number; text?: string }>,
  candSegs: Array<{ start?: number; text?: string }>,
  recName: string,
  candName: string,
): TranscriptSegment[] {
  const merged = [
    ...recSegs.map((s) => ({ start: s.start ?? 0, text: (s.text || '').trim(), speaker: recName })),
    ...candSegs.map((s) => ({
      start: s.start ?? 0,
      text: (s.text || '').trim(),
      speaker: candName,
    })),
  ]
    .filter((s) => s.text.length > 0)
    .sort((a, b) => a.start - b.start)

  const grouped: TranscriptSegment[] = []
  for (const seg of merged) {
    const last = grouped[grouped.length - 1]
    if (last && last.speaker === seg.speaker) {
      last.text += ' ' + seg.text
    } else {
      grouped.push({ ...seg })
    }
  }
  return grouped
}

const ERR_MEDIA =
  'Não consegui acessar sua câmera/microfone. Verifique a permissão do navegador (ícone de cadeado na barra de endereço).'
const ERR_NOT_FOUND =
  'Sala não encontrada. O entrevistador já entrou? Use o link mais recente que ele enviou.'
const ERR_DROPPED = 'A conexão caiu. Recarregue e entrem de novo na mesma sala.'
const ERR_HOST_UNAVAILABLE =
  'Não consegui abrir esta sala agora. Feche outras abas desta entrevista e tente de novo.'

export default function BancadeEntrevista() {
  const searchParams = new URLSearchParams(window.location.search)
  const urlSala = searchParams.get('sala') || ''
  const urlPapel = searchParams.get('papel') || ''

  const [phase, setPhase] = useState<Phase>('gate')
  const [roomCode, setRoomCode] = useState(urlSala || generateRoomCode())
  const [name, setName] = useState('')
  const [connState, setConnState] = useState<ConnState>('idle')
  const [remoteName, setRemoteName] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [recDuration, setRecDuration] = useState(0)
  const [waitDuration, setWaitDuration] = useState(0)
  const [recruiterSize, setRecruiterSize] = useState(0)
  const [candidateSize, setCandidateSize] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hostPreparing, setHostPreparing] = useState(false)
  const [recruiterBlob, setRecruiterBlob] = useState<Blob | null>(null)
  const [candidateBlob, setCandidateBlob] = useState<Blob | null>(null)

  const [transcription, setTranscription] = useState<TranscriptSegment[] | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [partialTranscribeError, setPartialTranscribeError] = useState<string | null>(null)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [vagas, setVagas] = useState<VagaOption[]>([])
  const [candidatos, setCandidatos] = useState<CandidatoOption[]>([])
  const [selectedVaga, setSelectedVaga] = useState('')
  const [selectedCandidato, setSelectedCandidato] = useState('')

  const [peerOpen, setPeerOpen] = useState(false)
  const [peerError, setPeerError] = useState<string | null>(null)
  const [guestAttemptCount, setGuestAttemptCount] = useState(0)
  const [dataChannelOpen, setDataChannelOpen] = useState(false)
  const [mediaDelayed, setMediaDelayed] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const isHost = urlPapel !== 'candidato'

  const peerRef = useRef<Peer | null>(null)
  const dataConnRef = useRef<DataConnection | null>(null)
  const mediaConnRef = useRef<MediaConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const localChunksRef = useRef<Blob[]>([])
  const remoteChunksRef = useRef<Blob[]>([])
  const pendingChunksRef = useRef<ArrayBuffer[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const waitStartRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHostRef = useRef(isHost)
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const endedRef = useRef(false)
  const retriedRef = useRef(false)
  const connectedRef = useRef(false)
  const hostRetryCountRef = useRef(0)
  const guestRetryRef = useRef(false)
  const guestRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cleanedRef = useRef(false)
  const waitingLocalRef = useRef<HTMLVideoElement>(null)

  isHostRef.current = isHost

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  const setWaitingLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      waitingLocalRef.current = el
      if (el && localStream && el.srcObject !== localStream) {
        el.srcObject = localStream
      }
    },
    [localStream],
  )

  const setRoomLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el
      if (el && localStream && el.srcObject !== localStream) {
        el.srcObject = localStream
      }
    },
    [localStream],
  )

  const setRoomRemoteVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteVideoRef.current = el
      if (el && remoteStream && el.srcObject !== remoteStream) {
        el.srcObject = remoteStream
      }
    },
    [remoteStream],
  )

  useEffect(() => {
    if (dataChannelOpen && !remoteStream) {
      const t = setTimeout(() => setMediaDelayed(true), 10000)
      return () => clearTimeout(t)
    }
    setMediaDelayed(false)
  }, [dataChannelOpen, remoteStream])

  useEffect(() => {
    if (!selectedVaga) {
      setCandidatos([])
      setSelectedCandidato('')
      return
    }
    supabase
      .from('candidatos')
      .select('id, nome, vaga_id')
      .eq('vaga_id', selectedVaga)
      .order('nome', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setCandidatos(data as CandidatoOption[])
      })
  }, [selectedVaga])

  const flushPendingChunks = useCallback(() => {
    const conn = dataConnRef.current
    if (!conn || !conn.open) return
    while (pendingChunksRef.current.length > 0 && conn.open) {
      const buf = pendingChunksRef.current.shift()
      if (buf !== undefined) {
        conn.send(buf)
      }
    }
  }, [])

  const startRecording = useCallback(
    (stream: MediaStream) => {
      const audioOnly = new MediaStream(stream.getAudioTracks())
      localChunksRef.current = []
      pendingChunksRef.current = []
      try {
        recorderRef.current = new MediaRecorder(audioOnly, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 32000,
        })
      } catch {
        recorderRef.current = new MediaRecorder(audioOnly)
      }
      recorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          localChunksRef.current.push(e.data)
          setRecruiterSize((prev) => prev + e.data.size)
          e.data.arrayBuffer().then((buf) => {
            pendingChunksRef.current.push(buf)
            flushPendingChunks()
          })
        }
      }
      recorderRef.current.start(3000)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setRecDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    },
    [flushPendingChunks],
  )

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current)
      retryRef.current = null
    }
    if (waitTimerRef.current) {
      clearInterval(waitTimerRef.current)
      waitTimerRef.current = null
    }
    if (guestRetryIntervalRef.current) {
      clearInterval(guestRetryIntervalRef.current)
      guestRetryIntervalRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    if (cleanedRef.current) return
    cleanedRef.current = true
    stopRecording()
    clearAllTimers()
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current)
      stopTimeoutRef.current = null
    }
    mediaConnRef.current?.close()
    dataConnRef.current?.close()
    peerRef.current?.destroy()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    pendingChunksRef.current = []
  }, [stopRecording, clearAllTimers])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (phase === 'room' && recorderRef.current && recorderRef.current.state === 'recording') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  const handleEnd = useCallback(() => {
    if (!isHostRef.current || endedRef.current) return
    endedRef.current = true
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ stop: true })
    }
    stopRecording()
    stopTimeoutRef.current = setTimeout(() => {
      const recBlob = new Blob(localChunksRef.current, { type: 'audio/webm' })
      setRecruiterBlob(recBlob)
      const candBlob = new Blob(remoteChunksRef.current, { type: 'audio/webm' })
      setCandidateBlob(candBlob)
      setPhase('ended')
    }, 1500)
  }, [stopRecording])

  const setupHostPeer = useCallback(
    (id: string, userName: string) => {
      const peer = new Peer(id, PEER_CONFIG)
      peerRef.current = peer

      peer.on('error', (err: any) => {
        console.error('[Host] Peer error:', err)
        if (err.type === 'unavailable-id') {
          hostRetryCountRef.current += 1
          if (hostRetryCountRef.current <= HOST_MAX_RETRIES) {
            setHostPreparing(true)
            peer.destroy()
            retryRef.current = setTimeout(() => {
              setupHostPeer(id, userName)
            }, HOST_RETRY_INTERVAL)
            return
          }
          setHostPreparing(false)
          setConnState('error')
          setErrorMessage(ERR_HOST_UNAVAILABLE)
          return
        }
        setHostPreparing(false)
        setConnState('error')
        if (connectedRef.current) {
          setErrorMessage(ERR_DROPPED)
        } else {
          setErrorMessage(ERR_NOT_FOUND)
        }
      })

      peer.on('open', () => {
        setHostPreparing(false)
        hostRetryCountRef.current = 0
        navigator.mediaDevices
          .getUserMedia({
            video: { width: { ideal: 640 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
          .then((stream) => {
            localStreamRef.current = stream
            setLocalStream(stream)
            startRecording(stream)
          })
          .catch((err) => {
            console.error('[Host] getUserMedia error:', err)
            setConnState('error')
            setErrorMessage(ERR_MEDIA)
          })
      })

      peer.on('connection', (conn) => {
        dataConnRef.current = conn
        conn.on('open', () => {
          conn.send({ hello: userName })
          flushPendingChunks()
        })
        conn.on('data', (data) => {
          const blob = toBlob(data)
          if (blob) {
            remoteChunksRef.current.push(blob)
            setCandidateSize((prev) => prev + blob.size)
            return
          }
          if (typeof data === 'object' && data !== null) {
            const msg = data as Record<string, unknown>
            if (msg.hello && typeof msg.hello === 'string') setRemoteName(msg.hello)
            if (msg.stop === true) handleEnd()
          }
        })
        conn.on('close', () => {
          if (!endedRef.current) {
            if (connectedRef.current) {
              setConnState('error')
              setErrorMessage(ERR_DROPPED)
            } else {
              setConnState('timeout')
            }
          }
        })
      })

      peer.on('call', (call) => {
        mediaConnRef.current = call
        call.answer(localStreamRef.current || undefined)
        call.on('stream', (remoteVid) => {
          remoteStreamRef.current = remoteVid
          setRemoteStream(remoteVid)
          connectedRef.current = true
          setConnState('connected')
        })
        call.on('error', (err) => console.error('[Host] Call error:', err))
      })
    },
    [startRecording, handleEnd, flushPendingChunks],
  )

  const initHost = useCallback(
    async (sala: string, userName: string) => {
      setConnState('connecting')
      setHostPreparing(true)
      hostRetryCountRef.current = 0
      const id = deterministicHostId(sala)
      setupHostPeer(id, userName)
    },
    [setupHostPeer],
  )

  const guestAttemptConnection = useCallback(
    (peer: Peer, targetHostId: string, stream: MediaStream, userName: string) => {
      if (connectedRef.current || endedRef.current) return

      const conn = peer.connect(targetHostId, { reliable: true })
      dataConnRef.current = conn

      const call = peer.call(targetHostId, stream)
      if (call) {
        mediaConnRef.current = call
        call.on('stream', (remoteVid) => {
          remoteStreamRef.current = remoteVid
          setRemoteStream(remoteVid)
          connectedRef.current = true
          setConnState('connected')
          clearAllTimers()
        })
        call.on('error', (err) => console.error('[Guest] Call error:', err))
      }

      conn.on('open', () => {
        conn.send({ hello: userName })
        flushPendingChunks()
      })

      conn.on('data', (data) => {
        const blob = toBlob(data)
        if (blob) {
          remoteChunksRef.current.push(blob)
          setRecruiterSize((prev) => prev + blob.size)
          return
        }
        if (typeof data === 'object' && data !== null) {
          const msg = data as Record<string, unknown>
          if (msg.hello && typeof msg.hello === 'string') setRemoteName(msg.hello)
          if (msg.stop === true) {
            stopRecording()
            const recBlob = new Blob(localChunksRef.current, { type: 'audio/webm' })
            setRecruiterBlob(recBlob)
            const candBlob = new Blob(remoteChunksRef.current, { type: 'audio/webm' })
            setCandidateBlob(candBlob)
            setPhase('ended')
          }
        }
      })

      conn.on('close', () => {
        if (endedRef.current || connectedRef.current) return
      })
    },
    [stopRecording, clearAllTimers, flushPendingChunks],
  )

  const initGuest = useCallback(
    async (sala: string, userName: string) => {
      setConnState('connecting')
      const peer = new Peer(PEER_CONFIG)
      peerRef.current = peer
      const targetHostId = deterministicHostId(sala)

      peer.on('error', (err: any) => {
        console.error('[Guest] Peer error:', err)
        if (err.type === 'peer-unavailable') {
          if (!connectedRef.current && !endedRef.current) {
            setConnState('waiting')
          }
          return
        }
        if (connectedRef.current) {
          setConnState('error')
          setErrorMessage(ERR_DROPPED)
        }
      })

      peer.on('open', async () => {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
        } catch (err: any) {
          console.error('[Guest] getUserMedia error:', err)
          setConnState('error')
          setErrorMessage(ERR_MEDIA)
          return
        }
        localStreamRef.current = stream
        setLocalStream(stream)
        startRecording(stream)

        setConnState('waiting')
        waitStartRef.current = Date.now()
        setWaitDuration(0)
        if (waitTimerRef.current) clearInterval(waitTimerRef.current)
        waitTimerRef.current = setInterval(() => {
          setWaitDuration(Math.floor((Date.now() - waitStartRef.current) / 1000))
        }, 500)

        guestAttemptConnection(peer, targetHostId, stream, userName)

        guestRetryIntervalRef.current = setInterval(() => {
          if (connectedRef.current || endedRef.current) {
            if (guestRetryIntervalRef.current) {
              clearInterval(guestRetryIntervalRef.current)
              guestRetryIntervalRef.current = null
            }
            return
          }
          dataConnRef.current?.close()
          mediaConnRef.current?.close()
          guestAttemptConnection(peer, targetHostId, stream, userName)
        }, GUEST_RETRY_INTERVAL)
      })
    },
    [startRecording, guestAttemptConnection],
  )

  const handleEnter = useCallback(
    (userName: string) => {
      cleanedRef.current = false
      endedRef.current = false
      connectedRef.current = false
      setPhase('connecting')
      if (isHost) initHost(roomCode, userName)
      else initGuest(roomCode, userName)
      setPhase('room')
    },
    [isHost, roomCode, initHost, initGuest],
  )

  const handleBackToGate = useCallback(() => {
    cleanup()
    cleanedRef.current = false
    endedRef.current = false
    connectedRef.current = false
    hostRetryCountRef.current = 0
    setPhase('gate')
    setConnState('idle')
    setErrorMessage(null)
    setHostPreparing(false)
    setLocalStream(null)
    setRemoteStream(null)
    setWaitDuration(0)
  }, [cleanup])

  const handleTranscribe = useCallback(async () => {
    if (!recruiterBlob || !candidateBlob) return
    const tenantId = resolveTenantId()
    if (!tenantId) {
      setTranscribeError(
        'Nenhuma empresa ativa. Faça login no Lynxs, selecione a empresa e reabra a bancada por lá.',
      )
      return
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setTranscribeError('Sessão expirada. Faça login novamente.')
      return
    }

    setTranscribing(true)
    setTranscribeError(null)
    setPartialTranscribeError(null)
    try {
      const recName = name || 'Recrutador'
      const candName = remoteName || 'Candidato'
      const [recSettled, candSettled] = await Promise.allSettled([
        transcribeTrack(recruiterBlob, recName, tenantId, session.access_token),
        transcribeTrack(candidateBlob, candName, tenantId, session.access_token),
      ])

      const recSegs = recSettled.status === 'fulfilled' ? recSettled.value.segments || [] : []
      const candSegs = candSettled.status === 'fulfilled' ? candSettled.value.segments || [] : []

      const errors: string[] = []
      if (recSettled.status === 'rejected') {
        const msg =
          recSettled.reason instanceof Error ? recSettled.reason.message : String(recSettled.reason)
        errors.push(`A faixa de ${recName} não pôde ser transcrita: ${msg}`)
      }
      if (candSettled.status === 'rejected') {
        const msg =
          candSettled.reason instanceof Error
            ? candSettled.reason.message
            : String(candSettled.reason)
        errors.push(`A faixa de ${candName} não pôde ser transcrita: ${msg}`)
      }

      if (recSegs.length === 0 && candSegs.length === 0) {
        setTranscribeError('Não foi possível transcrever nenhuma faixa de áudio.')
        return
      }

      const merged = mergeTranscripts(recSegs, candSegs, recName, candName)
      setTranscription(merged)

      if (errors.length > 0) {
        setPartialTranscribeError(errors.join('\n'))
      }

      const { data: vagasData } = await supabase
        .from('vagas')
        .select('id, titulo, cargo, empresa')
        .eq('tenant_id', tenantId)
        .eq('status', 'aberta')
        .order('criado_em', { ascending: false })
      if (vagasData) setVagas(vagasData as VagaOption[])
    } catch (err: any) {
      setTranscribeError(err.message || 'Erro ao transcrever áudio')
    } finally {
      setTranscribing(false)
    }
  }, [recruiterBlob, candidateBlob, name, remoteName])

  const transcriptText = transcription?.map((s) => `${s.speaker}:\n${s.text}`).join('\n\n') || ''

  const handleAnalyze = useCallback(async () => {
    if (!selectedVaga || !selectedCandidato || transcriptText.length < 100) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const { data, error } = await supabase.functions.invoke('lab-analyze-interview', {
        body: {
          vaga_id: selectedVaga,
          candidato_id: selectedCandidato,
          transcricao: transcriptText,
        },
      })
      if (error) throw error
      setAnalysis(data as AnalysisResult)
    } catch (err: any) {
      setAnalyzeError(err.message || 'Erro ao analisar entrevista')
    } finally {
      setAnalyzing(false)
    }
  }, [selectedVaga, selectedCandidato, transcriptText])

  const handleNewInterview = useCallback(() => {
    window.location.reload()
  }, [])

  if (phase === 'gate') {
    const candidateLink = `${window.location.origin}/bancada-entrevista?sala=${encodeURIComponent(
      roomCode,
    )}&papel=candidato`
    const interviewerLink = `${window.location.origin}/bancada-entrevista?sala=${encodeURIComponent(
      roomCode,
    )}&papel=recrutador`

    return (
      <div className="max-w-2xl mx-auto py-12 space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-plum-suave flex items-center justify-center mx-auto">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bancada de Entrevista</h1>
          <p className="text-slate-500">Ambiente de testes — dry-run sem persistência</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 leading-relaxed">
                {renderConsent(CONSENT_TEXT)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Código da sala</label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Código da sala"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Seu nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim() && roomCode.trim()) {
                    handleEnter(name.trim())
                  }
                }}
              />
            </div>

            <Button
              className="w-full h-11"
              disabled={!name.trim() || !roomCode.trim()}
              onClick={() => handleEnter(name.trim())}
            >
              {isHost ? 'Entrar como recrutador' : 'Entrar na sala'}
            </Button>

            {isHost && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Link do candidato</label>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-xs font-mono break-all bg-slate-50 rounded-md p-2 border select-all">
                      {candidateLink}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(candidateLink)
                        toast.success('Link do candidato copiado!')
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                    </Button>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    Pode enviar com antecedência. O candidato entra na hora marcada, em qualquer
                    ordem.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Seu link de entrevistador
                  </label>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-xs font-mono break-all bg-slate-50 rounded-md p-2 border select-all">
                      {interviewerLink}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(interviewerLink)
                        toast.success('Seu link de entrevistador foi copiado!')
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                    </Button>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    Guarde este link para entrar direto pela plataforma, sem passar pelo editor.
                  </p>
                </div>
              </>
            )}

            <div className="text-center text-xs text-slate-400">
              Sala: <span className="font-mono font-medium">{roomCode}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (hostPreparing && connState !== 'error') {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-lg font-medium text-slate-700">Preparando a sala…</p>
            <p className="text-sm text-slate-500">
              Aguarde enquanto registramos a sala de entrevista.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (connState === 'waiting') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-lg font-medium">Aguardando o entrevistador entrar…</span>
          </div>
          <p className="text-sm text-slate-400">
            Sua câmera está ativa. A conexão será feita automaticamente quando o entrevistador
            chegar.
          </p>
          <p className="text-slate-500 font-mono text-sm">
            Tempo de espera: {formatTime(waitDuration)}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
              {name} (Você)
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={handleBackToGate}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Sair da sala
          </Button>
        </div>
      </div>
    )
  }

  if (connState === 'timeout') {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="border-red-200">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-lg font-medium text-red-700">{ERR_NOT_FOUND}</p>
            <Button variant="outline" onClick={handleBackToGate}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (connState === 'error' && errorMessage) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="border-red-200">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-lg font-medium text-red-700">Erro de conexão</p>
            <p className="text-sm text-slate-600">{errorMessage}</p>
            <Button variant="outline" onClick={handleBackToGate}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'ended') {
    if (!isHost) {
      return (
        <div className="max-w-md mx-auto py-20 animate-fade-in-up">
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Entrevista encerrada</h2>
              <p className="text-slate-500">
                Obrigado pela participação, você já pode fechar esta janela.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    const recName = name || 'Recrutador'
    const candName = remoteName || 'Candidato'
    const cost = (recDuration / 60) * 0.006 * 2
    const canAnalyze = !!selectedVaga && !!selectedCandidato && transcriptText.length >= 100

    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6 animate-fade-in-up">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Entrevista Encerrada</h1>
          <p className="text-slate-500 flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4" /> Duração: {formatTime(recDuration)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivos de Áudio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => recruiterBlob && downloadBlob(recruiterBlob, 'faixa-recrutador.webm')}
              disabled={!recruiterBlob}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> faixa-recrutador.webm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => candidateBlob && downloadBlob(candidateBlob, 'faixa-candidato.webm')}
              disabled={!candidateBlob}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> faixa-candidato.webm
            </Button>
            {transcription && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadBlob(
                    new Blob([transcriptText], { type: 'text/plain' }),
                    'transcricao.txt',
                  )
                }
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> transcricao.txt
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> Transcrição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!transcription && !transcribing && !transcribeError && (
              <Button onClick={handleTranscribe} disabled={!recruiterBlob || !candidateBlob}>
                <Sparkles className="w-4 h-4 mr-2" /> Transcrever áudio
              </Button>
            )}
            {transcribing && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Transcrevendo as duas faixas...
              </div>
            )}
            {transcribeError && (
              <div className="text-sm text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {transcribeError}
              </div>
            )}
            {transcription && (
              <>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pb-3 border-b">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(recDuration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {transcription.length} turnos
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> ~US$ {cost.toFixed(3)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(transcriptText)
                      toast.success('Transcrição copiada!')
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar transcrição
                  </Button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {transcription.map((seg, i) => {
                    const isRec = seg.speaker === recName
                    return (
                      <div
                        key={i}
                        className={`flex gap-3 pl-3 border-l-2 ${
                          isRec ? 'border-primary' : 'border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                            isRec ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {getInitials(seg.speaker)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{seg.speaker}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              {formatTime(seg.start)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{seg.text}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {partialTranscribeError && (
                  <p className="text-xs text-amber-600 whitespace-pre-line">
                    {partialTranscribeError}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {transcription && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Análise Comportamental (DISC)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!analysis && !analyzing && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Vaga</label>
                      <Select value={selectedVaga} onValueChange={setSelectedVaga}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione a vaga" />
                        </SelectTrigger>
                        <SelectContent>
                          {vagas.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.titulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Candidato</label>
                      <Select
                        value={selectedCandidato}
                        onValueChange={setSelectedCandidato}
                        disabled={!selectedVaga}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione o candidato" />
                        </SelectTrigger>
                        <SelectContent>
                          {candidatos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {!canAnalyze && (
                    <p className="text-xs text-slate-400">
                      {!selectedVaga && 'Selecione uma vaga. '}
                      {!selectedCandidato && 'Selecione um candidato. '}
                      {transcriptText.length < 100 &&
                        'Transcrição deve ter ao menos 100 caracteres.'}
                    </p>
                  )}
                  {analyzeError && (
                    <p className="text-sm text-red-600 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {analyzeError}
                    </p>
                  )}
                  <Button onClick={handleAnalyze} disabled={!canAnalyze}>
                    <Sparkles className="w-4 h-4 mr-2" /> Analisar entrevista
                  </Button>
                </>
              )}
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analisando entrevista com IA...
                </div>
              )}
              {analysis && (
                <div className="space-y-4">
                  {analysis.disc && (
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-sm font-semibold">
                        Perfil {analysis.disc.profile}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        Confiança: {Math.round((analysis.disc.confidence || 0) * 100)}%
                      </span>
                    </div>
                  )}
                  {analysis.disc && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {DISC_FACTORS.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{f.label}</span>
                            <span className="font-medium">{analysis.disc?.[f.key] ?? 0}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${analysis.disc?.[f.key] ?? 0}%`,
                                backgroundColor: f.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {analysis.relatorio && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={REC_STYLES[analysis.relatorio.recommendation] || ''}
                      >
                        {analysis.relatorio.recommendation}
                      </Badge>
                      <span className="text-sm font-medium">
                        Score: {analysis.score_simulado}/100
                      </span>
                    </div>
                  )}
                  {analysis.relatorio?.executive_summary && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-sm text-slate-700">
                        {analysis.relatorio.executive_summary}
                      </p>
                    </div>
                  )}
                  {analysis.relatorio && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Pontos Fortes
                        </h4>
                        <ul className="space-y-1">
                          {analysis.relatorio.strengths?.map((s, i) => (
                            <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                              <span className="text-green-600">•</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> Riscos
                        </h4>
                        <ul className="space-y-1">
                          {analysis.relatorio.risks?.map((r, i) => (
                            <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                              <span className="text-red-600">•</span> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {analysis.relatorio?.next_steps && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Próximos Passos</h4>
                      <p className="text-xs text-slate-600">{analysis.relatorio.next_steps}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 italic">
                    Resultado simulado (dry-run). Nada foi gravado no banco.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button variant="outline" onClick={handleNewInterview}>
            <RotateCcw className="w-4 h-4 mr-2" /> Nova entrevista
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
          <video
            ref={setRoomLocalVideo}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
            {name} (Você)
          </span>
        </div>
        <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
          {remoteStream ? (
            <video
              ref={setRoomRemoteVideo}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              <span className="text-slate-400 text-sm">Aguardando conexão...</span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
            {remoteName || 'Aguardando...'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-sm">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <Radio className="w-3 h-3 mr-1.5 animate-pulse" />
          gravando
        </Badge>
        <span className="text-slate-600 font-mono">{formatTime(recDuration)}</span>
        <span className="text-slate-500">Você: {Math.round(recruiterSize / 1024)} KB</span>
        <span className="text-slate-500">
          {remoteName || 'Aguardando...'}: {Math.round(candidateSize / 1024)} KB
        </span>
      </div>

      {isHost && connState === 'connected' && (
        <div className="flex justify-center">
          <Button variant="destructive" size="lg" onClick={handleEnd}>
            <PhoneOff className="w-5 h-5 mr-2" /> Encerrar Entrevista
          </Button>
        </div>
      )}
    </div>
  )
}
