import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('Erro 404: Usuário tentou acessar rota inexistente:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-6 max-w-md p-6">
        <AlertCircle className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-xl text-muted-foreground">Página não encontrada</p>
        <p className="text-sm text-muted-foreground">
          A URL que você tentou acessar não existe ou foi movida.
        </p>
        <Link to="/" className="inline-block mt-4">
          <Button>Voltar para o Início</Button>
        </Link>
      </div>
    </div>
  )
}

export default NotFound
