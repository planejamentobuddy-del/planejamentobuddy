import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const EMAILJS_SERVICE_ID = Deno.env.get('EMAILJS_SERVICE_ID') || 'service_9mqvcmk'
const EMAILJS_TEMPLATE_ID = Deno.env.get('EMAILJS_TEMPLATE_ID') || 'template_nx3t6k9'
const EMAILJS_PUBLIC_KEY = Deno.env.get('EMAILJS_PUBLIC_KEY') || 'Qhetc14cLK_AIVJ5d'
const EMAILJS_PRIVATE_KEY = Deno.env.get('EMAILJS_PRIVATE_KEY') || 'fFCeTJHIRgyA2dOSn0BJ6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight request fallback
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()

    // Dispatch to EmailJS API
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email: payload.to_email,
          usuario_destino: payload.usuario_destino,
          obra_nome: payload.obra_nome,
          insumo_nome: payload.insumo_nome,
          quantitativo: payload.quantitativo,
          status_atual: payload.status_atual,
          prioridade: payload.prioridade,
          prazo_pedido: payload.prazo_pedido,
          prazo_entrega: payload.prazo_entrega,
          observacoes: payload.observacoes,
          app_url: payload.app_url || 'https://planejamentobuddy.vercel.app'
        }
      })
    })

    const textResponse = await res.text()
    if (!res.ok) {
      throw new Error(`EmailJS API error (${res.status}): ${textResponse}`)
    }

    return new Response(
      JSON.stringify({ success: true, response: textResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
