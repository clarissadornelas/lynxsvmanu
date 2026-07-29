// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acesso_agentes: {
        Row: {
          agente_id: string
          ativo: boolean
          data_cancelamento: string | null
          data_contratacao: string
          id: string
          plano_contratado: string
          tenant_id: string | null
          usuario_id: string
          valor_mensal: number
        }
        Insert: {
          agente_id: string
          ativo?: boolean
          data_cancelamento?: string | null
          data_contratacao?: string
          id?: string
          plano_contratado: string
          tenant_id?: string | null
          usuario_id: string
          valor_mensal: number
        }
        Update: {
          agente_id?: string
          ativo?: boolean
          data_cancelamento?: string | null
          data_contratacao?: string
          id?: string
          plano_contratado?: string
          tenant_id?: string | null
          usuario_id?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "acesso_agentes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_agente: {
        Row: {
          agendada_para: string
          agent_type: string
          candidato_id: string | null
          criado_em: string
          executada_em: string | null
          id: string
          motivo: string | null
          motivo_escalacao: string | null
          resultado: string | null
          status: string
          tenant_id: string
          texto_composto: string | null
          tipo_acao: string
          vaga_id: string | null
        }
        Insert: {
          agendada_para: string
          agent_type: string
          candidato_id?: string | null
          criado_em?: string
          executada_em?: string | null
          id?: string
          motivo?: string | null
          motivo_escalacao?: string | null
          resultado?: string | null
          status?: string
          tenant_id: string
          texto_composto?: string | null
          tipo_acao: string
          vaga_id?: string | null
        }
        Update: {
          agendada_para?: string
          agent_type?: string
          candidato_id?: string | null
          criado_em?: string
          executada_em?: string | null
          id?: string
          motivo?: string | null
          motivo_escalacao?: string | null
          resultado?: string | null
          status?: string
          tenant_id?: string
          texto_composto?: string | null
          tipo_acao?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acoes_agente_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_agente_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_agente_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          agendada_para: string
          calendar_event_id: string | null
          candidato_id: string
          criado_em: string
          duracao: number | null
          etapa: number
          id: string
          link_google_calendar: string | null
          meet_link: string | null
          parecer: string | null
          status: string
          tenant_id: string
          usuario_id: string | null
          vaga_id: string
        }
        Insert: {
          agendada_para: string
          calendar_event_id?: string | null
          candidato_id: string
          criado_em?: string
          duracao?: number | null
          etapa?: number
          id?: string
          link_google_calendar?: string | null
          meet_link?: string | null
          parecer?: string | null
          status?: string
          tenant_id: string
          usuario_id?: string | null
          vaga_id: string
        }
        Update: {
          agendada_para?: string
          calendar_event_id?: string | null
          candidato_id?: string
          criado_em?: string
          duracao?: number | null
          etapa?: number
          id?: string
          link_google_calendar?: string | null
          meet_link?: string | null
          parecer?: string | null
          status?: string
          tenant_id?: string
          usuario_id?: string | null
          vaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas_externas: {
        Row: {
          ativa: boolean | null
          criado_em: string
          ical_url: string | null
          id: string
          rotulo: string | null
          tenant_id: string
          ultima_sincronizacao: string | null
          usuario_id: string | null
        }
        Insert: {
          ativa?: boolean | null
          criado_em?: string
          ical_url?: string | null
          id?: string
          rotulo?: string | null
          tenant_id: string
          ultima_sincronizacao?: string | null
          usuario_id?: string | null
        }
        Update: {
          ativa?: boolean | null
          criado_em?: string
          ical_url?: string | null
          id?: string
          rotulo?: string | null
          tenant_id?: string
          ultima_sincronizacao?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendas_externas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendas_externas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model: string
          name: string
          provider: string
          system_prompt: string
          temperature: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model: string
          name: string
          provider: string
          system_prompt: string
          temperature?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string
          name?: string
          provider?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key_encrypted: string
          created_at: string
          id: string
          provider: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          id?: string
          provider: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          id?: string
          provider?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      base_ativa: {
        Row: {
          abertura: string
          adiado_ate: string | null
          cadencia_dias: number
          candidato_id: string | null
          categoria: string | null
          consentimento: boolean
          consentimento_em: string | null
          contato_ate: string | null
          contexto_relacionamento: string | null
          criado_em: string
          email: string | null
          empresa_atual: string | null
          id: string
          indicado_por: string | null
          lead_quente: boolean
          mercado: string | null
          nicho: string | null
          nivel: string | null
          nome: string | null
          opt_out: boolean
          opt_out_em: string | null
          orientacao_agente: string | null
          origem: string
          pings_enviados: number
          segmento: string | null
          sentimento: string | null
          status_profissional: string
          telefone: string
          tenant_id: string
          ultima_resposta_em: string | null
          ultimo_cargo: string | null
          ultimo_ping_em: string | null
        }
        Insert: {
          abertura?: string
          adiado_ate?: string | null
          cadencia_dias?: number
          candidato_id?: string | null
          categoria?: string | null
          consentimento?: boolean
          consentimento_em?: string | null
          contato_ate?: string | null
          contexto_relacionamento?: string | null
          criado_em?: string
          email?: string | null
          empresa_atual?: string | null
          id?: string
          indicado_por?: string | null
          lead_quente?: boolean
          mercado?: string | null
          nicho?: string | null
          nivel?: string | null
          nome?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          orientacao_agente?: string | null
          origem?: string
          pings_enviados?: number
          segmento?: string | null
          sentimento?: string | null
          status_profissional?: string
          telefone: string
          tenant_id: string
          ultima_resposta_em?: string | null
          ultimo_cargo?: string | null
          ultimo_ping_em?: string | null
        }
        Update: {
          abertura?: string
          adiado_ate?: string | null
          cadencia_dias?: number
          candidato_id?: string | null
          categoria?: string | null
          consentimento?: boolean
          consentimento_em?: string | null
          contato_ate?: string | null
          contexto_relacionamento?: string | null
          criado_em?: string
          email?: string | null
          empresa_atual?: string | null
          id?: string
          indicado_por?: string | null
          lead_quente?: boolean
          mercado?: string | null
          nicho?: string | null
          nivel?: string | null
          nome?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          orientacao_agente?: string | null
          origem?: string
          pings_enviados?: number
          segmento?: string | null
          sentimento?: string | null
          status_profissional?: string
          telefone?: string
          tenant_id?: string
          ultima_resposta_em?: string | null
          ultimo_cargo?: string | null
          ultimo_ping_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_ativa_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_ativa_indicado_por_fkey"
            columns: ["indicado_por"]
            isOneToOne: false
            referencedRelation: "base_ativa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_ativa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_agenda: {
        Row: {
          agenda_id: string | null
          criado_em: string
          fim: string
          id: string
          inicio: string
          tenant_id: string
          titulo: string | null
          usuario_id: string | null
        }
        Insert: {
          agenda_id?: string | null
          criado_em?: string
          fim: string
          id?: string
          inicio: string
          tenant_id: string
          titulo?: string | null
          usuario_id?: string | null
        }
        Update: {
          agenda_id?: string | null
          criado_em?: string
          fim?: string
          id?: string
          inicio?: string
          tenant_id?: string
          titulo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_agenda_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueios_agenda_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      candidato_eventos: {
        Row: {
          agente: string | null
          ator: string | null
          candidato_id: string
          criado_em: string
          de: string | null
          id: string
          para: string | null
          payload: Json | null
          tenant_id: string | null
          tipo: string | null
          vaga_id: string | null
        }
        Insert: {
          agente?: string | null
          ator?: string | null
          candidato_id: string
          criado_em?: string
          de?: string | null
          id?: string
          para?: string | null
          payload?: Json | null
          tenant_id?: string | null
          tipo?: string | null
          vaga_id?: string | null
        }
        Update: {
          agente?: string | null
          ator?: string | null
          candidato_id?: string
          criado_em?: string
          de?: string | null
          id?: string
          para?: string | null
          payload?: Json | null
          tenant_id?: string | null
          tipo?: string | null
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidato_eventos_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidato_eventos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      candidatos: {
        Row: {
          cargo: string | null
          consentimento: boolean
          consentimento_em: string | null
          contratado_em: string | null
          criado_em: string
          cv_texto: string | null
          cv_url: string | null
          dados_adicionais: string | null
          data_contratacao: string | null
          email: string | null
          empresa: string | null
          etapa_atual: number
          fase_saida: string | null
          foto_url: string | null
          id: string
          linkedin: string | null
          motivo_saida: string | null
          nome: string | null
          opt_out: boolean
          opt_out_em: string | null
          origem: string
          pdf_url: string | null
          score: number | null
          score_obs: string | null
          situacao: string
          situacao_em: string
          status: string
          telefone: string | null
          tenant_id: string
          vaga_id: string | null
        }
        Insert: {
          cargo?: string | null
          consentimento?: boolean
          consentimento_em?: string | null
          contratado_em?: string | null
          criado_em?: string
          cv_texto?: string | null
          cv_url?: string | null
          dados_adicionais?: string | null
          data_contratacao?: string | null
          email?: string | null
          empresa?: string | null
          etapa_atual?: number
          fase_saida?: string | null
          foto_url?: string | null
          id?: string
          linkedin?: string | null
          motivo_saida?: string | null
          nome?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          origem?: string
          pdf_url?: string | null
          score?: number | null
          score_obs?: string | null
          situacao?: string
          situacao_em?: string
          status?: string
          telefone?: string | null
          tenant_id: string
          vaga_id?: string | null
        }
        Update: {
          cargo?: string | null
          consentimento?: boolean
          consentimento_em?: string | null
          contratado_em?: string | null
          criado_em?: string
          cv_texto?: string | null
          cv_url?: string | null
          dados_adicionais?: string | null
          data_contratacao?: string | null
          email?: string | null
          empresa?: string | null
          etapa_atual?: number
          fase_saida?: string | null
          foto_url?: string | null
          id?: string
          linkedin?: string | null
          motivo_saida?: string | null
          nome?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          origem?: string
          pdf_url?: string | null
          score?: number | null
          score_obs?: string | null
          situacao?: string
          situacao_em?: string
          status?: string
          telefone?: string | null
          tenant_id?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          assunto: string
          atualizado_em: string
          categoria: string
          criado_em: string
          criado_por_email: string
          id: string
          mensagem: string
          resposta: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          assunto: string
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          criado_por_email: string
          id?: string
          mensagem: string
          resposta?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          assunto?: string
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          criado_por_email?: string
          id?: string
          mensagem?: string
          resposta?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_agente: {
        Row: {
          agent_type: string | null
          agente_id: string | null
          ativo: boolean
          cadencia_follow_up_dias: number | null
          criado_em: string
          criterios: Json | null
          criterios_cv: string | null
          criterios_entrevista: string | null
          dias_sem_resposta: number | null
          id: string
          mensagem_apresentacao: string | null
          modo: string
          nome_agente: string | null
          tenant_id: string | null
          tom: string | null
          tom_detalhe: string | null
        }
        Insert: {
          agent_type?: string | null
          agente_id?: string | null
          ativo?: boolean
          cadencia_follow_up_dias?: number | null
          criado_em?: string
          criterios?: Json | null
          criterios_cv?: string | null
          criterios_entrevista?: string | null
          dias_sem_resposta?: number | null
          id?: string
          mensagem_apresentacao?: string | null
          modo?: string
          nome_agente?: string | null
          tenant_id?: string | null
          tom?: string | null
          tom_detalhe?: string | null
        }
        Update: {
          agent_type?: string | null
          agente_id?: string | null
          ativo?: boolean
          cadencia_follow_up_dias?: number | null
          criado_em?: string
          criterios?: Json | null
          criterios_cv?: string | null
          criterios_entrevista?: string | null
          dias_sem_resposta?: number | null
          id?: string
          mensagem_apresentacao?: string | null
          modo?: string
          nome_agente?: string | null
          tenant_id?: string | null
          tom?: string | null
          tom_detalhe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_agente_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_agente_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          candidato_id: string | null
          contato_id: string | null
          contexto: string
          criado_em: string
          estado: string
          id: string
          pausada: boolean
          slots_propostos: Json | null
          tenant_id: string
          ultima_interacao: string
        }
        Insert: {
          candidato_id?: string | null
          contato_id?: string | null
          contexto?: string
          criado_em?: string
          estado?: string
          id?: string
          pausada?: boolean
          slots_propostos?: Json | null
          tenant_id: string
          ultima_interacao?: string
        }
        Update: {
          candidato_id?: string | null
          contato_id?: string | null
          contexto?: string
          criado_em?: string
          estado?: string
          id?: string
          pausada?: boolean
          slots_propostos?: Json | null
          tenant_id?: string
          ultima_interacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "base_ativa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      disparos: {
        Row: {
          agente: string
          chave_idempotencia: string
          contato_ref: string
          criado_em: string
          id: string
          numero: string
          status: string
          tenant_id: string
        }
        Insert: {
          agente: string
          chave_idempotencia: string
          contato_ref: string
          criado_em?: string
          id?: string
          numero: string
          status?: string
          tenant_id: string
        }
        Update: {
          agente?: string
          chave_idempotencia?: string
          contato_ref?: string
          criado_em?: string
          id?: string
          numero?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disparos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade: {
        Row: {
          ativo: boolean
          dia_semana: number
          duracao_entrevista: number
          hora_fim: string
          hora_inicio: string
          id: string
          tenant_id: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          dia_semana: number
          duracao_entrevista?: number
          hora_fim: string
          hora_inicio: string
          id?: string
          tenant_id: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          dia_semana?: number
          duracao_entrevista?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tenant_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidade_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          ag1_assessor: boolean
          ag2_copiloto: boolean
          ag3_ativador: boolean
          atualizado_em: string
          tenant_id: string
        }
        Insert: {
          ag1_assessor?: boolean
          ag2_copiloto?: boolean
          ag3_ativador?: boolean
          atualizado_em?: string
          tenant_id: string
        }
        Update: {
          ag1_assessor?: boolean
          ag2_copiloto?: boolean
          ag3_ativador?: boolean
          atualizado_em?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entrevistas: {
        Row: {
          agendamento_id: string | null
          candidato_id: string
          criado_em: string
          disc: Json | null
          fireflies_id: string | null
          id: string
          notas: string | null
          realizada_em: string | null
          realizada_por_id: string | null
          resumo: string | null
          rodada: number
          roteiro: string | null
          status: string
          tenant_id: string
          transcricao: string | null
          vaga_id: string
        }
        Insert: {
          agendamento_id?: string | null
          candidato_id: string
          criado_em?: string
          disc?: Json | null
          fireflies_id?: string | null
          id?: string
          notas?: string | null
          realizada_em?: string | null
          realizada_por_id?: string | null
          resumo?: string | null
          rodada?: number
          roteiro?: string | null
          status?: string
          tenant_id: string
          transcricao?: string | null
          vaga_id: string
        }
        Update: {
          agendamento_id?: string | null
          candidato_id?: string
          criado_em?: string
          disc?: Json | null
          fireflies_id?: string | null
          id?: string
          notas?: string | null
          realizada_em?: string | null
          realizada_por_id?: string | null
          resumo?: string | null
          rodada?: number
          roteiro?: string | null
          status?: string
          tenant_id?: string
          transcricao?: string | null
          vaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entrevistas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_realizada_por_id_fkey"
            columns: ["realizada_por_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_agenda_externa: {
        Row: {
          agenda_externa_id: string
          criado_em: string
          fim: string
          id: string
          inicio: string
          tenant_id: string
          titulo: string | null
        }
        Insert: {
          agenda_externa_id: string
          criado_em?: string
          fim: string
          id?: string
          inicio: string
          tenant_id: string
          titulo?: string | null
        }
        Update: {
          agenda_externa_id?: string
          criado_em?: string
          fim?: string
          id?: string
          inicio?: string
          tenant_id?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_agenda_externa_agenda_externa_id_fkey"
            columns: ["agenda_externa_id"]
            isOneToOne: false
            referencedRelation: "agendas_externas"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          is_webhook_enabled: boolean | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          is_webhook_enabled?: boolean | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          is_webhook_enabled?: boolean | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados_customizados: {
        Row: {
          criado_em: string
          data: string
          id: string
          nome: string
          tenant_id: string
        }
        Insert: {
          criado_em?: string
          data: string
          id?: string
          nome: string
          tenant_id: string
        }
        Update: {
          criado_em?: string
          data?: string
          id?: string
          nome?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feriados_customizados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          candidato_id: string
          criado_em: string
          data_agendada: string
          data_enviado: string | null
          dia_follow_up: number
          id: string
          mensagem_enviada: string | null
          processo_id: string | null
          resposta_candidato: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          candidato_id: string
          criado_em?: string
          data_agendada: string
          data_enviado?: string | null
          dia_follow_up: number
          id?: string
          mensagem_enviada?: string | null
          processo_id?: string | null
          resposta_candidato?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          candidato_id?: string
          criado_em?: string
          data_agendada?: string
          data_enviado?: string | null
          dia_follow_up?: number
          id?: string
          mensagem_enviada?: string | null
          processo_id?: string | null
          resposta_candidato?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          concluido_em: string | null
          criado_em: string
          erro: string | null
          id: string
          iniciado_em: string | null
          payload: Json
          resultado: Json | null
          status: string
          tenant_id: string
          tentativas: number
          tipo: string
        }
        Insert: {
          concluido_em?: string | null
          criado_em?: string
          erro?: string | null
          id?: string
          iniciado_em?: string | null
          payload?: Json
          resultado?: Json | null
          status?: string
          tenant_id: string
          tentativas?: number
          tipo: string
        }
        Update: {
          concluido_em?: string | null
          criado_em?: string
          erro?: string | null
          id?: string
          iniciado_em?: string | null
          payload?: Json
          resultado?: Json | null
          status?: string
          tenant_id?: string
          tentativas?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_exclusao: {
        Row: {
          contagens: Json | null
          criado_em: string
          executado_por_email: string | null
          executado_por_id: string | null
          id: string
          registro_id: string
          registro_nome: string | null
          tenant_id: string | null
          tipo: string
        }
        Insert: {
          contagens?: Json | null
          criado_em?: string
          executado_por_email?: string | null
          executado_por_id?: string | null
          id?: string
          registro_id: string
          registro_nome?: string | null
          tenant_id?: string | null
          tipo: string
        }
        Update: {
          contagens?: Json | null
          criado_em?: string
          executado_por_email?: string | null
          executado_por_id?: string | null
          id?: string
          registro_id?: string
          registro_nome?: string | null
          tenant_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_exclusao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          criado_em: string
          direcao: string
          id: string
          status: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          criado_em?: string
          direcao: string
          id?: string
          status?: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          criado_em?: string
          direcao?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          agente_id: string
          criado_em: string
          criado_por_email: string
          cupom: string | null
          id: string
          plano: string
          status: string
          tenant_id: string
          valor_mensal: number | null
        }
        Insert: {
          agente_id: string
          criado_em?: string
          criado_por_email: string
          cupom?: string | null
          id?: string
          plano: string
          status?: string
          tenant_id: string
          valor_mensal?: number | null
        }
        Update: {
          agente_id?: string
          criado_em?: string
          criado_por_email?: string
          cupom?: string | null
          id?: string
          plano?: string
          status?: string
          tenant_id?: string
          valor_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          agente_id: string | null
          candidato_id: string
          criado_em: string | null
          data_inicio: string | null
          id: string
          notas: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          agente_id?: string | null
          candidato_id: string
          criado_em?: string | null
          data_inicio?: string | null
          id?: string
          notas?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          agente_id?: string | null
          candidato_id?: string
          criado_em?: string | null
          data_inicio?: string | null
          id?: string
          notas?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          agente_nome: string | null
          ativo: boolean
          bloquear_feriados_br: boolean | null
          criado_em: string
          drive_folder_id: string | null
          empresa_logo_url: string | null
          google_calendar_id: string | null
          google_refresh_token: string | null
          headhunter_nome: string
          headhunter_telefone: string
          id: string
          janela_fim: number
          janela_inicio: number
          modo_revisao: boolean
          nome: string
          retencao_dias: number
          slug: string
          whatsapp_instance: string | null
          whatsapp_numero: string | null
        }
        Insert: {
          agente_nome?: string | null
          ativo?: boolean
          bloquear_feriados_br?: boolean | null
          criado_em?: string
          drive_folder_id?: string | null
          empresa_logo_url?: string | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          headhunter_nome: string
          headhunter_telefone: string
          id?: string
          janela_fim?: number
          janela_inicio?: number
          modo_revisao?: boolean
          nome: string
          retencao_dias?: number
          slug: string
          whatsapp_instance?: string | null
          whatsapp_numero?: string | null
        }
        Update: {
          agente_nome?: string | null
          ativo?: boolean
          bloquear_feriados_br?: boolean | null
          criado_em?: string
          drive_folder_id?: string | null
          empresa_logo_url?: string | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          headhunter_nome?: string
          headhunter_telefone?: string
          id?: string
          janela_fim?: number
          janela_inicio?: number
          modo_revisao?: boolean
          nome?: string
          retencao_dias?: number
          slug?: string
          whatsapp_instance?: string | null
          whatsapp_numero?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          criado_em: string
          id: string
          meta: Json | null
          quantidade: number
          ref: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          meta?: Json | null
          quantidade?: number
          ref?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          criado_em?: string
          id?: string
          meta?: Json | null
          quantidade?: number
          ref?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string | null
          id: string
          nome: string
          papel: string
          tenant_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          nome: string
          papel?: string
          tenant_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
          papel?: string
          tenant_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vagas: {
        Row: {
          agentes: string[]
          cargo: string | null
          codigo: string | null
          criado_em: string
          data_limite: string | null
          descricao: string
          dias_alerta: number
          empresa: string | null
          etapas: Json
          id: string
          janela: Json | null
          max_agendamentos: number
          modelo_entrevista: string
          salario_max: number | null
          salario_min: number | null
          salario_moeda: string | null
          status: string
          tenant_id: string
          titulo: string
        }
        Insert: {
          agentes?: string[]
          cargo?: string | null
          codigo?: string | null
          criado_em?: string
          data_limite?: string | null
          descricao: string
          dias_alerta?: number
          empresa?: string | null
          etapas?: Json
          id?: string
          janela?: Json | null
          max_agendamentos?: number
          modelo_entrevista?: string
          salario_max?: number | null
          salario_min?: number | null
          salario_moeda?: string | null
          status?: string
          tenant_id: string
          titulo: string
        }
        Update: {
          agentes?: string[]
          cargo?: string | null
          codigo?: string | null
          criado_em?: string
          data_limite?: string | null
          descricao?: string
          dias_alerta?: number
          empresa?: string | null
          etapas?: Json
          id?: string
          janela?: Json | null
          max_agendamentos?: number
          modelo_entrevista?: string
          salario_max?: number | null
          salario_min?: number | null
          salario_moeda?: string | null
          status?: string
          tenant_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "vagas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          instance_name: string
          last_message_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          instance_name: string
          last_message_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          last_message_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_text: string | null
          raw_payload: Json | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          message_text?: string | null
          raw_payload?: Json | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          raw_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_job: {
        Args: never
        Returns: {
          concluido_em: string | null
          criado_em: string
          erro: string | null
          id: string
          iniciado_em: string | null
          payload: Json
          resultado: Json | null
          status: string
          tenant_id: string
          tentativas: number
          tipo: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

