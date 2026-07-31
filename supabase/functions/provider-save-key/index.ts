import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  encrypt,
  hasEncryptionSecret,
  getEncryptionSecretStatus,
} from '../_shared/crypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { tenant_id, provider, api_key } = body;

    if (!tenant_id || !provider || !api_key) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenant_id, provider, api_key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, papel')
      .eq('email', user.email!)
      .eq('tenant_id', tenant_id)
      .eq('ativo', true)
      .maybeSingle();

    if (usuarioError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar vínculo: ' + usuarioError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: 'Sem vínculo ativo com esta empresa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (usuario.papel !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem salvar chaves de API' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!hasEncryptionSecret()) {
      const secretStatus = getEncryptionSecretStatus();
      return new Response(
        JSON.stringify({
          error: 'Erro de configuração: Segredo de criptografia não encontrado no servidor.',
          diagnostico: secretStatus,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const encryptedKey = await encrypt(api_key);

    const { data, error } = await supabase
      .from('ai_provider_keys')
      .upsert(
        {
          user_id: user.id,
          tenant_id,
          provider,
          api_key_encrypted: encryptedKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,provider' },
      )
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to save key: ' + error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ status: 'ok', id: data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal error: ' + message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
