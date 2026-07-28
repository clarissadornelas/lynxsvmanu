import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Video, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CandidateRoom() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [entrevista, setEntrevista] = useState<any>(null)
  const [candidato, setCandidato] = useState<any>(null)
  const [vaga, setVaga] = useState<any>(null)
  const [consentimento, setConsentimento] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('entrevistas').select('*').eq('id', id).single()
      if (error || !data) {
        setLoading(false)
        return
      }
      setEntrevista(data)
      const { data: v } = await supabase.from('vagas').select('*').eq('id', data.vaga_id).single()
      const { data: c } = await supabase
        .from('candidatos')
        .select('*')
        .eq('id', data.candidato_id)
        .single()
      setVaga(v)
      setCandidato(c)
      setConsentimento(c?.consentimento || false)
      setLoading(false)
    }
    if (id) {
      load()
    }
  }, [id])

  const aceitarLGPD = async () => {
    if (!candidato) return
    const { error } = await supabase
      .from('candidatos')
      .update({ consentimento: true, consentimento_em: new Date().toISOString() })
      .eq('id', candidato.id)
    if (!error) {
      setConsentimento(true)
      toast.success('Termos aceitos. Você já pode acessar a sala.')
    } else {
      toast.error('Erro ao salvar consentimento.')
    }
  }

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      toast.error('Erro ao acessar câmera/microfone. Por favor, permita o acesso.')
    }
  }

  useEffect(() => {
    if (consentimento && entrevista?.status !== 'analisada' && entrevista?.status !== 'entregue') {
      startVideo()
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [consentimento, entrevista?.status])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!entrevista || !candidato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-800">Sala não encontrada</h1>
          <p className="text-slate-500">Verifique se o link está correto.</p>
        </div>
      </div>
    )
  }

  if (
    entrevista.status === 'analisada' ||
    entrevista.status === 'entregue' ||
    entrevista.status === 'em_analise'
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center py-12">
          <CardContent className="space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
            <h2 className="text-2xl font-semibold">Entrevista Finalizada</h2>
            <p className="text-slate-500">
              Sua entrevista foi concluída com sucesso. Obrigado pelo seu tempo!
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!consentimento) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-indigo-100 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              Termos de Privacidade e LGPD
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-slate-600">
            <div className="bg-indigo-50/50 p-5 rounded-xl text-sm space-y-3 border border-indigo-100/50 text-indigo-900 leading-relaxed text-center font-medium">
              Esta entrevista será gravada para fins de análise e melhoria do processo seletivo.
              Seus dados serão tratados de acordo com a LGPD. Ao continuar, você concorda com a
              gravação e análise de dados.
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                size="lg"
                className="w-full text-slate-600 hover:bg-slate-100 transition-all"
                onClick={() => (window.location.href = '/')}
              >
                Não Concordo
              </Button>
              <Button
                size="lg"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                onClick={aceitarLGPD}
              >
                Concordo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex flex-col relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 w-full max-w-7xl mx-auto auto-rows-fr">
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center ring-1 ring-white/10 shadow-2xl">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center text-3xl text-white font-bold mb-4 shadow-lg">
              R
            </div>
            <p className="text-white/80 font-medium">Recrutador</p>
            <p className="text-white/50 text-sm mt-2 animate-pulse">Aguardando início...</p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center ring-1 ring-white/10 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-white/90 text-sm font-medium border border-white/10">
            Você
          </div>
        </div>
      </div>
    </div>
  )
}
