import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const EMAILJS_SERVICE_ID = Deno.env.get('EMAILJS_SERVICE_ID') || 'service_9mqvcmk'
const EMAILJS_TEMPLATE_ID = Deno.env.get('EMAILJS_TEMPLATE_ID') || 'template_nx3t6k9'
const EMAILJS_PUBLIC_KEY = Deno.env.get('EMAILJS_PUBLIC_KEY') || 'Qhetc14cLK_AIVJ5d'
const EMAILJS_PRIVATE_KEY = Deno.env.get('EMAILJS_PRIVATE_KEY') || 'fFCeTJHIRgyA2dOSn0BJ6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function computeOrderDeadline(arriveByStr?: string | null, daysBeforeOrder?: number | null): string | null {
  if (!arriveByStr) return null;
  const d = new Date(arriveByStr + 'T12:00:00');
  const offset = daysBeforeOrder || 30;
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function formatQuantitativeForEmail(val?: string | null): string {
  if (!val) return 'Não informado';
  const trimmed = val.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const items = JSON.parse(trimmed);
      if (Array.isArray(items) && items.length > 0) {
        return items
          .map((item: any) => {
            const qtyStr = item.qty ? `${item.qty} ` : '';
            const unitStr = item.unit ? `${item.unit} - ` : '';
            return `${qtyStr}${unitStr}${item.desc}`;
          })
          .join('\n');
      }
    } catch {
      return val;
    }
  }
  return val;
}

serve(async (req) => {
  // CORS preflight request fallback
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Initialize Supabase Admin client for DB operations in Cron Mode
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const payload = await req.json().catch(() => ({}));

    // ── MODE A: CRON JOB MODE (AUTONOMOUS SCANNING) ──
    if (payload?.cron === true) {
      // 1. Fetch active projects
      const { data: projects, error: projErr } = await supabase
        .from('projects')
        .select('id, name')
        .neq('status', 'archived')
      
      if (projErr) throw projErr

      // 2. Fetch supply packages that are pending
      const { data: packages, error: pkgErr } = await supabase
        .from('supply_packages')
        .select('*')
        .in('status', ['pending_quantitative', 'pending_order'])

      if (pkgErr) throw pkgErr

      // 3. Fetch active users profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('full_name, email')

      if (profErr) throw profErr

      const results = []

      for (const pkg of (packages || [])) {
        const project = projects?.find(p => p.id === pkg.project_id)
        if (!project) continue // skip archived project packages

        const deadline = pkg.order_deadline || computeOrderDeadline(pkg.arrive_by, pkg.days_before_order)
        const days = daysUntil(deadline)

        if (days === null) continue

        const isOverdue = days < 0
        const isUrgent = days >= 0 && days <= 10

        if (isOverdue || isUrgent) {
          const respName = pkg.responsible || 'Responsável'
          const userProfile = profiles?.find(u => u.full_name === pkg.responsible)
          const toEmail = userProfile?.email || (pkg.responsible ? `${respName.toLowerCase().replace(/\s+/g, '')}@buddyconstrutora.com.br` : 'planejamentobuddy@gmail.com')

          const priorityText = pkg.is_critical ? 'CRÍTICO 🔴' : (isOverdue ? 'ATRASADO ⚠️' : 'URGENTE ⚡')
          const deadlineStr = deadline ? deadline.split('-').reverse().join('/') : '—'
          const arriveStr = pkg.arrive_by ? pkg.arrive_by.split('-').reverse().join('/') : '—'

          const cleanNotes = (pkg.notes || '')
            .split('\n')
            .filter((line: string) => !line.trim().startsWith('[Notificação'))
            .join('\n')
            .trim() || 'Nenhuma'

          // Call EmailJS API
          const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: EMAILJS_SERVICE_ID,
              template_id: EMAILJS_TEMPLATE_ID,
              user_id: EMAILJS_PUBLIC_KEY,
              accessToken: EMAILJS_PRIVATE_KEY,
              template_params: {
                to_email: toEmail,
                usuario_destino: respName,
                obra_nome: project.name,
                insumo_nome: pkg.name,
                quantitativo: formatQuantitativeForEmail(pkg.quantitative),
                status_atual: pkg.status === 'pending_quantitative' ? 'Aguardando Quantitativo' : 'Aguardando Pedido',
                prioridade: priorityText,
                prazo_pedido: deadlineStr,
                prazo_entrega: arriveStr,
                observacoes: cleanNotes,
                app_url: 'https://planejamentobuddy.vercel.app/suprimentos'
              }
            })
          })

          const textRes = await emailRes.text()
          const ok = emailRes.ok

          // Update notes log in database
          const timestamp = new Date().toLocaleString('pt-BR')
          const statusText = ok ? 'Enviado automaticamente' : `Falhou no envio automático: ${textRes}`
          const newLog = `\n[Notificação disparada em ${timestamp} para ${toEmail} | Status: ${statusText}]`

          await supabase
            .from('supply_packages')
            .update({ notes: pkg.notes ? pkg.notes + newLog : newLog })
            .eq('id', pkg.id)

          results.push({ pkgName: pkg.name, recipient: toEmail, success: ok, response: textRes })
        }
      }

      return new Response(
        JSON.stringify({ success: true, cronRun: true, processed: results.length, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── MODE B: MANUAL FRONTEND DISPATCH MODE (SINGLE EMAIL) ──
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
          app_url: payload.app_url || 'https://planejamentobuddy.vercel.app/suprimentos'
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
