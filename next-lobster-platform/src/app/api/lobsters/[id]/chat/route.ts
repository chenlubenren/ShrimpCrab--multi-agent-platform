import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_LOBSTER_IDS = new Set(['lobster-001', 'research-bot-manager']);
const DEFAULT_MODEL = process.env.OPENCLAW_MODEL || 'openclaw:research-bot-manager';
const DEFAULT_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'research-bot-manager';

function buildGatewayUrl() {
  const base = process.env.OPENCLAW_GATEWAY_BASE_URL || 'http://127.0.0.1:18789';
  return `${base.replace(/\/$/, '')}/v1/chat/completions`;
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const lobsterId = context.params.id;

    if (!ALLOWED_LOBSTER_IDS.has(lobsterId)) {
      return NextResponse.json(
        { error: 'This lobster is not connected to OpenClaw chat.' },
        { status: 403 }
      );
    }

    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (!gatewayToken) {
      return NextResponse.json(
        { error: 'Missing OPENCLAW_GATEWAY_TOKEN on server.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const gatewayMessages = [
      {
        role: 'system',
        content:
          'You are research-bot-manager inside the lobster platform. You are the swarm coordinator for research-bot-dictator, research-bot-td, and research-bot-writer. Reply helpfully, clearly, and briefly in Chinese by default. When useful, explain coordination decisions succinctly, but stay focused on the user task.'
      },
      ...messages
        .filter((msg: unknown) => {
          if (!msg || typeof msg !== 'object') return false;
          const role = (msg as { role?: unknown }).role;
          const content = (msg as { content?: unknown }).content;
          return (
            (role === 'user' || role === 'assistant' || role === 'system') &&
            typeof content === 'string' &&
            content.trim().length > 0
          );
        })
        .map((msg: { role: 'user' | 'assistant' | 'system'; content: string }) => ({
          role: msg.role,
          content: msg.content,
        })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const response = await fetch(buildGatewayUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gatewayToken}`,
        'x-openclaw-agent-id': DEFAULT_AGENT_ID,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        user: `architecture:${lobsterId}`,
        messages: gatewayMessages,
        temperature: 0.7,
        stream: false,
      }),
      cache: 'no-store',
    });

    const rawText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Gateway request failed.',
          status: response.status,
          details: rawText,
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(rawText);
    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== 'string' || !answer.trim()) {
      return NextResponse.json(
        { error: 'Gateway returned an empty answer.', details: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      reply: answer.trim(),
      model: data?.model || DEFAULT_MODEL,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unexpected server error.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
