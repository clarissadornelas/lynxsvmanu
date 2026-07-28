import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getActiveTenantId } from '@/stores/useActiveContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials } from '@/lib/avatar-utils'

export function NewCandidateModal({ open, onOpenChange, onSuccess }: any) {
  const [loading, setLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const tenantId = getActiveTenantId()
    if (!tenantId) {
      setLoading(false)
      return
    }

    const { data: inserted, error } = await supabase
      .from('candidatos')
      .insert({
        tenant_id: tenantId,
        nome: fd.get('nome') as string,
        email: fd.get('email') as string,
        telefone: fd.get('telefone') as string,
        cargo: fd.get('cargo') as string,
        empresa: fd.get('empresa') as string,
        contratado_em: fd.get('contratado_em') as string,
        status: 'em_teste',
        origem: 'manual',
      })
      .select('id')
      .single()

    if (error) {
      toast.error('Erro ao cadastrar: ' + error.message)
      setLoading(false)
      return
    }

    if (photoFile && inserted) {
      try {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `${inserted.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('fotos-candidatos')
          .upload(path, photoFile, { upsert: true })
        if (!upErr) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('fotos-candidatos').getPublicUrl(path)
          await supabase.from('candidatos').update({ foto_url: publicUrl }).eq('id', inserted.id)
        }
      } catch {
        // Photo upload failure is non-blocking
      }
    }

    setLoading(false)
    toast.success('Candidato cadastrado. Follow-ups gerados automaticamente.')
    setPhotoFile(null)
    setPhotoPreview(null)
    setNome('')
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Novo Contratado (Onboarding)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-slate-200">
                <AvatarImage src={photoPreview || undefined} />
                <AvatarFallback className="bg-muted text-lg font-bold text-muted-foreground">
                  {getInitials(nome)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
            <span className="text-xs text-slate-400">Foto do candidato (opcional, máx 2MB)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input name="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de Início</Label>
              <Input name="contratado_em" type="date" required />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label>Email</Label>
              <Input name="email" type="email" />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label>Telefone</Label>
              <Input name="telefone" />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label>Cargo</Label>
              <Input name="cargo" />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label>Empresa</Label>
              <Input name="empresa" />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
