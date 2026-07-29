import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Wand2, Loader2, X } from 'lucide-react'

interface RefinarBlocoProps {
  shortcutChips: string[]
  onRefine: (instrucoes: string) => Promise<void>
}

export function RefinarBloco({ shortcutChips, onRefine }: RefinarBlocoProps) {
  const [expanded, setExpanded] = useState(false)
  const [instrucoes, setInstrucoes] = useState('')
  const [loading, setLoading] = useState(false)
  const maxChars = 500

  const handleChipClick = (chip: string) => {
    setInstrucoes((prev) => {
      if (!prev.trim()) return chip
      return `${prev}, ${chip}`
    })
  }

  const handleRefine = async () => {
    if (!instrucoes.trim() || loading) return
    setLoading(true)
    try {
      await onRefine(instrucoes.trim())
      setInstrucoes('')
      setExpanded(false)
    } catch {
      // Error handling is done by the parent via toast
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setInstrucoes('')
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(true)}
        className="text-primary hover:text-primary hover:bg-plum-tenue"
      >
        <Wand2 className="w-4 h-4 mr-1.5" />
        Refinar
      </Button>
    )
  }

  return (
    <div className="w-full mt-3 rounded-lg border border-plum-borda bg-indigo-50/50 p-3 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary flex items-center gap-1.5">
          <Wand2 className="w-4 h-4" /> Refinar com instruções
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-500"
          onClick={handleCancel}
          disabled={loading}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {shortcutChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            disabled={loading}
            className={cn(
              'rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 transition-colors',
              'hover:bg-plum-suave disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="relative">
        <Textarea
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value.slice(0, maxChars))}
          placeholder="Descreva os ajustes que você quer..."
          className="min-h-[80px] resize-none border-indigo-200 bg-white text-sm"
          disabled={loading}
        />
        <span
          className={cn(
            'absolute bottom-2 right-3 text-xs',
            instrucoes.length >= maxChars ? 'text-red-500' : 'text-slate-400',
          )}
        >
          {instrucoes.length}/{maxChars}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary text-white"
          onClick={handleRefine}
          disabled={loading || !instrucoes.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Refinando...
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5 mr-1.5" />
              Gerar nova versão
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
