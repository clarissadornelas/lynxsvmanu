import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'

export function HistoricoTab() {
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from('follow_ups')
        .select('*, candidatos(nome)')
        .eq('status', 'respondido')
        .order('criado_em', { ascending: false })
        .limit(50)
      if (data) setHistory(data)
    }
    loadData()
  }, [])

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200">
      <h3 className="text-lg font-semibold mb-6">Histórico de Comunicações</h3>
      <div className="space-y-6">
        {history.map((h) => (
          <div key={h.id} className="relative pl-6 border-l-2 border-indigo-200">
            <div className="absolute w-3 h-3 bg-indigo-600 rounded-full -left-[7px] top-1"></div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-900">{h.candidatos?.nome}</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                {h.dia_follow_up} Dias
              </span>
              <span className="text-sm text-slate-500">
                {h.data_enviado && format(new Date(h.data_enviado), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <div>
                <strong className="text-slate-900">RH:</strong> {h.mensagem_enviada}
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <strong className="text-slate-900 block mb-1">Candidato:</strong>
                {h.resposta_candidato || (
                  <span className="text-slate-400 italic">Sem resposta registrada</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <div className="text-slate-500 py-4">Nenhum histórico encontrado.</div>
        )}
      </div>
    </div>
  )
}
