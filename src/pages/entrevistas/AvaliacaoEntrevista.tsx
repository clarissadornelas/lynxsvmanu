import { useParams } from 'react-router-dom'

export default function AvaliacaoEntrevista() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="max-w-3xl mx-auto p-6">
      <p className="text-sm text-slate-500">Avaliação da entrevista {id}</p>
    </div>
  )
}
