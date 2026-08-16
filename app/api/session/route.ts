// app/api/session/route.ts
// ─────────────────────────────────────────────────────────────
// Creates an OpenAI Realtime session with an ephemeral key.
// The client uses this key directly for WebRTC — the real API
// key never leaves the server.
//
// Model: gpt-4o-realtime-preview-2024-12-17  (free tier: 100 min/day)
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

// ── Tools that OpenAI will call automatically mid-conversation ──
// Right now: RAG search (ready). Your teammate adds CRUD tools here.
const TOOLS = [
  {
    type: 'function',
    name: 'search_knowledge_base',
    description:
      'Search the SLT Mobitel knowledge base for product info, plans, coverage, policies, and FAQs. ' +
      'Call this whenever the user asks about SLT services, packages, or policies.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A clear English search query describing what the user needs',
        },
      },
      required: ['query'],
    },
  },
  // ── Your teammate adds these after building FastAPI backend ──
  {
    type: 'function',
    name: 'get_customer_info',
    description: 'Look up a customer account by phone number. Returns balance, package, bill status.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Customer mobile number e.g. 0771234567' },
      },
      required: ['phone'],
    },
  },
  {
    type: 'function',
    name: 'create_support_ticket',
    description: 'Create a new support ticket / complaint for a customer.',
    parameters: {
      type: 'object',
      properties: {
        phone:       { type: 'string', description: 'Customer phone number' },
        issue_type:  { type: 'string', description: 'Type: data_issue | billing | connection | other' },
        description: { type: 'string', description: 'Brief description of the problem' },
      },
      required: ['phone', 'issue_type', 'description'],
    },
  },
  {
    type: 'function',
    name: 'get_ticket_status',
    description: 'Get the status of an existing support ticket.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket ID' },
      },
      required: ['ticket_id'],
    },
  },
];

// ── System prompt — controls agent personality + language behaviour ──
function buildSystemPrompt(language: string): string {
  const langNote =
    language === 'si'
      ? 'The user prefers Sinhala. Respond in Sinhala (සිංහල) naturally. You may mix English technical terms.'
      : language === 'ta'
      ? 'The user prefers Tamil. Respond in Tamil (தமிழ்) naturally. You may mix English technical terms.'
      : 'Respond in clear, friendly English.';

  return `You are Nila, SLT Mobitel's intelligent customer support AI agent.
You represent Sri Lanka's national telecommunications provider.
${langNote}

PERSONALITY:
- Warm, professional, helpful — never robotic
- Speak in natural conversational sentences, not bullet lists
- Keep answers concise (2–4 sentences) unless detail is needed
- Always confirm you've understood before acting

CAPABILITIES:
- Answer questions about SLT Mobitel plans, data packages, fiber, 4G
- Look up customer accounts when given a phone number
- Create and check support tickets for complaints
- Search the knowledge base for policy and product questions

BEHAVIOUR:
- When a customer gives a phone number, call get_customer_info immediately
- When asked about plans or policy, call search_knowledge_base first
- When a customer reports a problem, collect phone + description, then call create_support_ticket
- Never make up data — always use tools to fetch real information
- If you cannot help, say so clearly and suggest calling 1212

IMPORTANT: You must ALWAYS use the search_knowledge_base tool before answering any
question about SLT products, plans, pricing, or policies.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const language: string = body.language ?? 'en';

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',

        // Voice: 'shimmer' = warm female, 'echo' = neutral male, 'alloy' = neutral
        voice: 'shimmer',

        instructions: buildSystemPrompt(language),
        tools: TOOLS,
        tool_choice: 'auto',

        // Server VAD — OpenAI detects when user starts/stops speaking automatically
        turn_detection: {
          type: 'server_vad',
          threshold: 0.45,            // sensitivity (lower = more sensitive)
          prefix_padding_ms: 300,     // audio before speech detected to include
          silence_duration_ms: 600,   // how long silence before turn ends
        },

        // Get text transcripts of both sides for the chat sidebar
        input_audio_transcription: { model: 'whisper-1' },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('OpenAI session error:', err);
      return NextResponse.json({ error: 'Failed to create session', detail: err }, { status: 500 });
    }

    const sessionData = await response.json();
    // Return the full session object — client needs client_secret.value
    return NextResponse.json(sessionData);
  } catch (err) {
    console.error('Session route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}