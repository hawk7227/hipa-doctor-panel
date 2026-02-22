import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const logs: string[] = []
  
  try {
    logs.push('1. Route hit')
    
    // Test: can we read the request?
    const body = await request.json()
    logs.push('2. Body parsed: ' + JSON.stringify(Object.keys(body)))
    
    // Test: can we access env vars?
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    logs.push(`3. Keys: anthropic=${hasAnthropicKey}, openai=${hasOpenAIKey}`)
    
    // Test: can we import brand?
    try {
      const { BRAND_NAME } = await import('@/lib/brand')
      logs.push('4. Brand loaded: ' + BRAND_NAME)
    } catch (e: any) {
      logs.push('4. BRAND IMPORT FAILED: ' + e.message)
    }
    
    // Test: can we import ai-config?
    try {
      const { getActualModelId } = await import('@/lib/ai-config')
      const model = getActualModelId('auto', 'anthropic')
      logs.push('5. ai-config loaded, auto→' + model)
    } catch (e: any) {
      logs.push('5. AI-CONFIG IMPORT FAILED: ' + e.message)
    }
    
    // Test: can we import key-pool?
    try {
      const { getKeyWithFailover } = await import('@/lib/key-pool')
      const result = getKeyWithFailover()
      logs.push(`6. key-pool: ${result ? result.provider + ' key found' : 'NO KEYS'}`)
    } catch (e: any) {
      logs.push('6. KEY-POOL IMPORT FAILED: ' + e.message)
    }
    
    // Test: can we import smart-context?
    try {
      const { classifyIntent } = await import('@/lib/smart-context')
      const intent = classifyIntent('hello')
      logs.push('7. smart-context loaded, intent=' + intent)
    } catch (e: any) {
      logs.push('7. SMART-CONTEXT IMPORT FAILED: ' + e.message)
    }
    
    // Test: can we call Anthropic?
    try {
      const key = process.env.ANTHROPIC_API_KEY
      if (key) {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 50, messages: [{ role: 'user', content: 'Say hi' }] })
        })
        const data = await resp.json()
        if (resp.ok) {
          logs.push('8. Anthropic API: OK — ' + (data.content?.[0]?.text || '').slice(0, 50))
        } else {
          logs.push('8. Anthropic API ERROR: ' + JSON.stringify(data.error || data))
        }
      } else {
        logs.push('8. No ANTHROPIC_API_KEY')
      }
    } catch (e: any) {
      logs.push('8. Anthropic call FAILED: ' + e.message)
    }
    
    return new Response(JSON.stringify({ status: 'diagnostic', logs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, logs }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: 'diagnostic route active' }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
