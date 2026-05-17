import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured for the analyze-leads function');
    }

    const { payload } = await req.json();
    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ error: 'payload is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const model = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat';
    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1100,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You audit a Physique 57 lead follow-up dashboard.',
              'Use only the compact JSON provided. Do not invent facts.',
              'Be conservative: flag only likely issues and cite leadId evidence.',
              'Return JSON only with keys: executiveSummary, urgentIssues, followUpTimingIssues, stageDiscrepancies, copyPasteSignals, recommendedActions.',
              'Each issue item should include leadId, severity, reason, evidence, recommendedAction.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              'Analyze this filtered lead dataset. It is capped to a maximum one-month window and prefiltered for token control.',
              'Focus on missed follow-ups, late/early follow-up cadence, missing welcome/call evidence, inconsistent comments versus stage/status, and copy-pasted follow-up notes.',
              compactJson(payload),
            ].join('\n'),
          },
        ],
      }),
    });

    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Preserve raw response if the provider returns non-JSON.
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: body }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = (body as { choices?: Array<{ message?: { content?: string } }>; usage?: unknown; model?: string })?.choices?.[0]?.message?.content ?? '';
    let analysis: unknown = content;
    try {
      analysis = JSON.parse(content);
    } catch {
      // Return raw content if JSON mode is unavailable.
    }

    return new Response(JSON.stringify({
      success: true,
      model: (body as { model?: string })?.model ?? model,
      usage: (body as { usage?: unknown })?.usage,
      analysis,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
