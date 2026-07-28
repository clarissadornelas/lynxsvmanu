import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { LifeBuoy } from 'lucide-react'

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'O que cada agente faz?',
    a: 'O Meu Assessor cuida do relacionamento com candidatos das vagas abertas: contata, agenda entrevistas e cobra respostas. O Copiloto trabalha por dentro da entrevista: prepara o roteiro de perguntas e analisa o candidato depois, com parecer e DISC. A Base Ativa mantém vivo o seu banco de talentos, com follow-ups periódicos em quem não está em processo.',
  },
  {
    q: 'Como crio uma vaga?',
    a: 'Em Meu Assessor, clique em Nova Vaga. A vaga é o ponto de partida de tudo: com ela criada, você adiciona candidatos e o sistema organiza agendamentos, entrevistas e análises em volta dela.',
  },
  {
    q: 'Como funciona a análise de currículo?',
    a: 'Ao adicionar um candidato com CV, a inteligência do sistema extrai os dados, compara com os requisitos da vaga e gera um resumo com pontuação. Você pode definir critérios da sua empresa em Configurar Agentes, na aba Copiloto, e eles passam a orientar todas as análises.',
  },
  {
    q: 'O que é a Central de Agentes?',
    a: 'É o painel de acompanhamento do trabalho autônomo dos agentes: o que está agendado, o que foi executado e o que está esperando uma decisão sua. É também onde você pausa ou reativa cada agente.',
  },
  {
    q: 'O que significa "Aguardando você"?',
    a: 'São situações em que o agente preferiu não decidir sozinho: uma resposta de candidato que ele não entendeu, um pedido de reagendamento, uma entrevista sem roteiro. Você resolve com um clique.',
  },
  {
    q: 'Como adiciono pessoas da minha equipe?',
    a: 'Cada pessoa cria a própria conta em "Sou usuário". O vínculo com a sua empresa é feito pelo administrador (em breve por convite direto na plataforma).',
  },
  {
    q: 'Como funciona a compra de agentes?',
    a: 'O administrador da empresa contrata cada agente em qualquer tela que exiba o botão Contratar. Durante a fase de testes, o pagamento online ainda não está ativo e pedidos podem ser liberados por cupom.',
  },
  {
    q: 'Meus dados estão isolados?',
    a: 'Sim. Tudo pertence à sua empresa (tenant): vagas, candidatos, entrevistas e configurações. Usuários só acessam empresas às quais foram vinculados.',
  },
]

export default function Ajuda() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Ajuda</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tire suas dúvidas sobre a plataforma</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left text-base font-medium text-slate-900">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-sm text-slate-600">Não achou o que procurava?</p>
        <Button asChild>
          <Link to="/contato">Falar com o suporte</Link>
        </Button>
      </div>
    </div>
  )
}
