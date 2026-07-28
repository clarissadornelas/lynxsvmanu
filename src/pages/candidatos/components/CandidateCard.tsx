import { Link } from 'react-router-dom'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Linkedin, FileText } from 'lucide-react'
import { DiscBadge } from '@/components/DiscBadge'
import { getInitials } from '@/lib/avatar-utils'
import type { CandidatoWithRelations } from '@/types/recruitment'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AddToBaseDialog } from './AddToBaseDialog'

export function CandidateCard({
  cand,
  onUpdateStatus,
  tenantId,
  alreadyInBase,
}: {
  cand: CandidatoWithRelations
  onUpdateStatus: (id: string, status: string) => void
  tenantId?: string | null
  alreadyInBase?: boolean
}) {
  const getLinkedInUrl = (text?: string) => {
    if (!text) return null
    const match = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[^\s\n)'"]+/i)
    return match ? match[0] : null
  }

  const getScoreColor = (score: number) => {
    if (!score) return '#94a3b8'
    if (score <= 40) return '#E63946'
    if (score <= 60) return '#F77F00'
    if (score <= 80) return '#FDB833'
    return '#06A77D'
  }

  const linkedinUrl =
    getLinkedInUrl(cand.cv_texto) || (cand.cv_url?.includes('linkedin') ? cand.cv_url : null)
  const scoreColor = getScoreColor(cand.score)

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardContent className="flex-1 pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3">
            <Avatar className="h-12 w-12 bg-muted">
              <AvatarImage src={cand.foto_url || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                {getInitials(cand.nome)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-lg leading-tight">{cand.nome}</h3>
              <p
                className="text-sm text-muted-foreground line-clamp-1"
                title={cand.vagas?.titulo || 'Sem Vaga Vinculada'}
              >
                {cand.vagas?.titulo || 'Sem Vaga Vinculada'}
              </p>
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center text-xs mt-1"
                >
                  <Linkedin className="w-3 h-3 mr-1" /> LinkedIn
                </a>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-white border-none font-bold shadow-sm"
            style={{ backgroundColor: scoreColor }}
          >
            {cand.score ? `${cand.score}%` : 'N/A'}
          </Badge>
        </div>

        <div className="space-y-3 mt-4">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground text-xs">Status Atual</span>
            <Select value={cand.status} onValueChange={(val) => onUpdateStatus(cand.id, val)}>
              <SelectTrigger className="h-8 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="shortlist">Shortlist</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="entrevistado">Entrevistado</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="contratado">Contratado</SelectItem>
                <SelectItem value="reprovado">Rejeitado</SelectItem>
                <SelectItem value="descartado">Descartado</SelectItem>
                <SelectItem value="inativo">Inativar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-muted-foreground text-xs block mb-1">Análise Comportamental</span>
            {cand.entrevistas?.[0]?.disc ? (
              <DiscBadge disc={cand.entrevistas[0].disc} />
            ) : (
              <Badge variant="secondary" className="font-normal text-xs">
                <FileText className="w-3 h-3 mr-1" /> Pendente
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t p-3 flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button variant="default" size="sm" className="w-full text-xs" asChild>
            <Link to={`/candidatos/${cand.id}`}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver Perfil
            </Link>
          </Button>
        </div>
        <AddToBaseDialog
          candidatoId={cand.id}
          nome={cand.nome}
          email={cand.email}
          telefone={cand.telefone}
          empresaAtual={cand.empresa}
          ultimoCargo={cand.cargo}
          tenantId={tenantId}
          alreadyInBase={alreadyInBase}
          triggerVariant="card"
        />
      </CardFooter>
    </Card>
  )
}
