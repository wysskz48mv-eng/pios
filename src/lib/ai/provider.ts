import { createClient } from '@supabase/supabase-js'

export type AIProviderName = 'anthropic_claude' | 'openai_chatgpt' | 'google_gemini'
export type AIProviderRole = 'primary' | 'fallback_1' | 'fallback_2'

export interface AIProviderMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIProviderRequest {
  system: string
  messages: AIProviderMessage[]
  maxTokens?: number
  temperature?: number
  context?: string
  userId?: string
  preferredModel?: string
}

export interface AIProviderResponse {
  content: string
  provider: AIProviderName
  model: string
  tokens: {
    input: number
    output: number
    total: number
  }
  latencyMs: number
  failoverOccurred: boolean
  failoverFrom?: AIProviderName
}

const DEFAULT_PROVIDER_ORDER: AIProviderName[] = [
  'anthropic_claude',
  'openai_chatgpt',
  'google_gemini',
]

const REQUEST_TIMEOUT_MS = 30_000
const FAILURE_THRESHOLD = 3

const failureCounters: Record<AIProviderName, number> = {
  anthropic_claude: 0,
  openai_chatgpt: 0,
  google_gemini: 0,
}

function getApiKey(provider: AIProviderName): string | undefined {
  const keyMap: Record<AIProviderName, string | undefined> = {
    anthropic_claude: process.env.ANTHROPIC_API_KEY,
    openai_chatgpt: process.env.OPENAI_API_KEY,
    google_gemini: process.env.GOOGLE_GEMINI_API_KEY,
  }

  return keyMap[provider]
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function getProviderOrder(): Promise<AIProviderName[]> {
  try {
    const supabase = getServiceSupabase()
    if (!supabase) return DEFAULT_PROVIDER_ORDER

    const { data, error } = await supabase
      .from('ai_provider_config')
      .select('provider_name, role')
      .eq('is_active', true)

    if (error || !data?.length) return DEFAULT_PROVIDER_ORDER

    const roleOrder: Record<AIProviderRole, number> = {
      primary: 0,
      fallback_1: 1,
      fallback_2: 2,
    }

    return data
      .sort((left, right) => roleOrder[left.role as AIProviderRole] - roleOrder[right.role as AIProviderRole])
      .map((row) => row.provider_name as AIProviderName)
  } catch {
    return DEFAULT_PROVIDER_ORDER
  }
}

async function logHealthEvent(args: {
  provider: AIProviderName
  success: boolean
  latencyMs: number
  errorCode?: string
  errorMessage?: string
  failoverTriggered?: boolean
  failoverTo?: AIProviderName
}) {
  try {
    const supabase = getServiceSupabase()
    if (!supabase) return

    await supabase.from('ai_provider_health_log').insert({
      provider_name: args.provider,
      check_type: 'completion',
      success: args.success,
      latency_ms: args.latencyMs,
      error_code: args.errorCode ?? null,
      error_message: args.errorMessage ?? null,
      failover_triggered: args.failoverTriggered ?? false,
      failover_to: args.failoverTo ?? null,
    })
  } catch {
    // Health telemetry must never break inference.
  }
}

async function updateProviderState(provider: AIProviderName, success: boolean) {
  try {
    const supabase = getServiceSupabase()
    if (!supabase) return

    if (success) {
      await supabase
        .from('ai_provider_config')
        .update({
          last_success_at: new Date().toISOString(),
          consecutive_failures: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_name', provider)
      return
    }

    const { data } = await supabase
      .from('ai_provider_config')
      .select('consecutive_failures')
      .eq('provider_name', provider)
      .single()

    await supabase
      .from('ai_provider_config')
      .update({
        last_failure_at: new Date().toISOString(),
        consecutive_failures: (data?.consecutive_failures ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_name', provider)
  } catch {
    // Same rule: best-effort only.
  }
}

function buildAbortSignal() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return { controller, timeout }
}

async function callAnthropic(request: AIProviderRequest, apiKey: string, startedAt: number): Promise<AIProviderResponse> {
  const { controller, timeout } = buildAbortSignal()

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.preferredModel ?? 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens ?? 1000,
        temperature: request.temperature ?? 0.2,
        system: request.system,
        messages: request.messages,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Anthropic ${res.status}: ${body}`)
    }

    const data = await res.json()
    const input = data.usage?.input_tokens ?? 0
    const output = data.usage?.output_tokens ?? 0

    return {
      content: data.content?.[0]?.text ?? '',
      provider: 'anthropic_claude',
      model: data.model ?? (request.preferredModel ?? 'claude-sonnet-4-20250514'),
      tokens: { input, output, total: input + output },
      latencyMs: Date.now() - startedAt,
      failoverOccurred: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function callOpenAI(request: AIProviderRequest, apiKey: string, startedAt: number): Promise<AIProviderResponse> {
  const { controller, timeout } = buildAbortSignal()

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: request.maxTokens ?? 1000,
        temperature: request.temperature ?? 0.2,
        messages: [
          { role: 'system', content: request.system },
          ...request.messages,
        ],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OpenAI ${res.status}: ${body}`)
    }

    const data = await res.json()
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      provider: 'openai_chatgpt',
      model: data.model ?? 'gpt-4o',
      tokens: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - startedAt,
      failoverOccurred: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function callGemini(request: AIProviderRequest, apiKey: string, startedAt: number): Promise<AIProviderResponse> {
  const { controller, timeout } = buildAbortSignal()

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.system }] },
        contents: request.messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 1000,
          temperature: request.temperature ?? 0.2,
        },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini ${res.status}: ${body}`)
    }

    const data = await res.json()
    const input = data.usageMetadata?.promptTokenCount ?? 0
    const output = data.usageMetadata?.candidatesTokenCount ?? 0

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      provider: 'google_gemini',
      model: 'gemini-1.5-pro',
      tokens: { input, output, total: input + output },
      latencyMs: Date.now() - startedAt,
      failoverOccurred: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function completeWithFailover(request: AIProviderRequest): Promise<AIProviderResponse> {
  const providerOrder = await getProviderOrder()
  let failoverOccurred = false
  let failoverFrom: AIProviderName | undefined

  for (let index = 0; index < providerOrder.length; index++) {
    const provider = providerOrder[index]
    if (failureCounters[provider] >= FAILURE_THRESHOLD) continue

    const apiKey = getApiKey(provider)
    if (!apiKey) continue

    const startedAt = Date.now()
    if (index > 0) {
      failoverOccurred = true
      failoverFrom = providerOrder[index - 1]
    }

    try {
      const response = provider === 'anthropic_claude'
        ? await callAnthropic(request, apiKey, startedAt)
        : provider === 'openai_chatgpt'
          ? await callOpenAI(request, apiKey, startedAt)
          : await callGemini(request, apiKey, startedAt)

      failureCounters[provider] = 0
      void logHealthEvent({
        provider,
        success: true,
        latencyMs: response.latencyMs,
        failoverTriggered: failoverOccurred,
        failoverTo: failoverFrom,
      })
      void updateProviderState(provider, true)

      return {
        ...response,
        failoverOccurred,
        failoverFrom,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const latencyMs = Date.now() - startedAt
      failureCounters[provider] += 1
      const thresholdReached = failureCounters[provider] >= FAILURE_THRESHOLD

      void logHealthEvent({
        provider,
        success: false,
        latencyMs,
        errorCode: 'REQUEST_FAILED',
        errorMessage: message,
        failoverTriggered: thresholdReached,
        failoverTo: thresholdReached ? providerOrder[index + 1] : undefined,
      })

      if (thresholdReached) {
        void updateProviderState(provider, false)
      }
    }
  }

  throw new Error('All configured AI providers failed or are unavailable.')
}