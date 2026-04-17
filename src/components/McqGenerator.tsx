import { MCQQuestion, Difficulty, DifficultyDistribution, QuizMode } from '../types'

export interface MCQCreatorConfig {
  provider: string
  apiKey: string
  model: string
  ollamaUrl: string
}

function normalizeOllamaModel(model: string): string {
  // Ollama cloud model IDs are the canonical names from /v1/models.
  // We accept legacy UI values like "gemma4:31b-cloud" and normalize them here.
  return model.replace(/-cloud$/, '')
}

function shuffleQuestionOptions(question: MCQQuestion): MCQQuestion {
  if (!Array.isArray(question.options) || question.options.length < 2) return question

  const paired = question.options.map((option, index) => ({ option, index }))
  for (let i = paired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[paired[i], paired[j]] = [paired[j], paired[i]]
  }

  const newCorrectIndex = paired.findIndex(item => item.index === question.correct_answer)

  return {
    ...question,
    options: paired.map(item => item.option),
    correct_answer: newCorrectIndex >= 0 ? newCorrectIndex : question.correct_answer
  }
}

function getBatchStyle(batchOffset: number): string {
  const styles = [
    'Use concise, direct wording and a practical framing.',
    'Use scenario-based wording with one realistic constraint.',
    'Prefer comparison-style questions that distinguish similar concepts.',
    'Focus on edge cases, limitations, or failure modes.',
    'Favor concept-application over definition recall.'
  ]

  return styles[batchOffset % styles.length]
}

function getAnswerBalanceHint(batchOffset: number): string {
  const target = ['A', 'B', 'C', 'D'][batchOffset % 4]
  return `For this batch, make the correct answer appear especially often in position ${target}.`
}

export async function fetchOllamaModels(apiKey: string, ollamaUrl: string): Promise<string[]> {
  const baseUrl = ollamaUrl.replace(/\/+$/, '')
  const isCloud = baseUrl.includes('ollama.com')
  const url = isCloud ? '/ollama-cloud-api/v1/models' : `${baseUrl}/v1/models`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Ollama model lookup failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const models = Array.isArray(data?.data)
    ? data.data
        .map((m: any) => m?.id || m?.name)
        .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
    : Array.isArray(data?.models)
      ? data.models
          .map((m: any) => m?.name || m?.id || m?.model)
          .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
      : []

  return [...new Set(models.map(normalizeOllamaModel))] as string[]
}

export function parseMCQResponse(text: string): MCQQuestion[] {
  // Strategy 1: Find everything between the FIRST [ and the LAST ]
  // but if that fails to parse, try to find the FIRST [ that is followed by {
  // which is a better indicator of our question array start.
  
  const extractAndParse = (input: string): MCQQuestion[] => {
    try {
      const parsed = JSON.parse(input)
      let candidate: any = null

      if (Array.isArray(parsed)) {
        candidate = parsed
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Look for any array property if it's an object (Strategy 2)
        const arrays = Object.values(parsed).filter(v => Array.isArray(v))
        if (arrays.length > 0) {
          // Take the largest array (likely the questions)
          candidate = arrays.sort((a: any, b: any) => b.length - a.length)[0]
        }
      }

      if (!Array.isArray(candidate)) return []

      const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard']

      return candidate
        .filter((q: any) => q && typeof q === 'object' && q.question_text && q.options)
        .map((q: any, i: number) => ({
          question_id: q.question_id || `q-${String(i + 1).padStart(3, '0')}`,
          question_text: q.question_text,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : 0,
          difficulty: validDifficulties.includes(q.difficulty) ? q.difficulty : 'medium',
          tags: Array.isArray(q.tags) ? q.tags : [],
          explanation: q.explanation || ''
        }))
        .map(shuffleQuestionOptions)
    } catch {
      return []
    }
  }

  // Try parsing the whole text first (it might be clean JSON)
  const firstTry = extractAndParse(text)
  if (firstTry.length > 0) return firstTry

  // Try finding the array start specifically with [{
  const arrayWithObjectMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (arrayWithObjectMatch) {
    const secondTry = extractAndParse(arrayWithObjectMatch[0])
    if (secondTry.length > 0) return secondTry
  }

  // Fallback to the original greedy match
  const greedyMatch = text.match(/\[[\s\S]*\]/)
  if (greedyMatch) {
    const thirdTry = extractAndParse(greedyMatch[0])
    if (thirdTry.length > 0) return thirdTry
  }

  // Final fallback: try finding any object if it's wrapped
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    const fourthTry = extractAndParse(objectMatch[0])
    if (fourthTry.length > 0) return fourthTry
  }

  return []
}

const SYSTEM_PROMPT = (topic: string, _distribution: DifficultyDistribution, batchCount: number, batchOffset: number) => {
  return `You are a world-class assessment designer with deep expertise in "${topic}". Your goal is to create exactly ${batchCount} distinct multiple-choice questions (Batch starting at index ${batchOffset + 1}).

Question Design Principles:
1. HIGH-COMPETITION DISTRACTORS - Every wrong option must represent a real misconception. Distractors should be plausible to someone who only half-knows the topic.
2. BALANCED ANSWER POSITIONS - Distribute the correct answer roughly evenly across A, B, C, and D for the full batch. Do not put the correct answer in position A more often than the others.
3. RICH & DESCRIPTIVE EXPLANATIONS - Each explanation must be easy to understand yet comprehensive. Explain why distractors are wrong.
4. TOPIC RELEVANCE - Every question must directly test "${topic}" and avoid trivia, ambiguity, or overly broad prompts.
5. BATCH STYLE - ${getBatchStyle(batchOffset)}
6. BATCH HINT - ${getAnswerBalanceHint(batchOffset)}

Return ONLY a valid JSON array (no surrounding text) with this structure:
[
  {
    "question_id": "q-${String(batchOffset + 1).padStart(3, '0')}",
    "question_text": "A clear, well-formed question?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "difficulty": "medium",
    "tags": ["subtopic-1", "subtopic-2"],
    "explanation": "**Why it's right:** [Clear logic]. **Why distractors are wrong:** [Address misconceptions for A, B, C, D]. **Key Tip:** [One-sentence pedagogical insight]."
  }
]
- Options must be subtly different to test genuine mastery.
- Explanations must be descriptive, easy to understand, and mentor-like.
- Make the correct answer placement vary across the set.`
}


const INTERVIEWER_SYSTEM_PROMPT = (projectDetails: string, _distribution: DifficultyDistribution, batchCount: number, batchOffset: number) => {
  return `You are a world-class senior technical interviewer. Your goal is to create ${batchCount} interview questions (Batch starting at index ${batchOffset + 1}) for the project: "${projectDetails}".

Guidelines:
1. FOCUS ON MASTERY - Ask about architectural "Why" and "How", trade-offs, failure modes, and implementation choices that matter in real systems.
2. HIGH-COMPETITION DISTRACTORS - Options test genuine expertise and should all look believable to a strong candidate.
3. BALANCED ANSWER POSITIONS - Distribute the correct answer roughly evenly across A, B, C, and D for the full batch. Avoid letting A dominate.
4. SCOPE CONTROL - Keep every question tightly anchored to the provided project details. No generic interview fluff.
5. DESCRIPTIVE EXPLANATIONS - Professional and pedagogical explanations.
6. BATCH STYLE - ${getBatchStyle(batchOffset)}
7. BATCH HINT - ${getAnswerBalanceHint(batchOffset)}

Return ONLY a valid JSON array with this structure:
[
  {
    "question_id": "q-${String(batchOffset + 1).padStart(3, '0')}",
    "question_text": "Scenario-based question?",
    "options": ["A", "B", "C", "D"],
    "correct_answer": 1,
    "difficulty": "hard",
    "tags": ["architecture", "scaling"],
    "explanation": "**Technical Context:** [Principal logic]. **The Dilemma:** [Why it's a hard choice]. **Distractor Analysis:** [Why other options represent specific risks or sub-optimal patterns]."
  }
]
- Options must be professional and "confusing" to anyone but an expert.
- Explanations must be pedagogical and professional.
- Make the correct answer placement vary across the set.`
}


function getPrompt(mode: QuizMode, topic: string, distribution: DifficultyDistribution, batchCount: number, batchOffset: number): string {
  return mode === 'interviewer'
    ? INTERVIEWER_SYSTEM_PROMPT(topic, distribution, batchCount, batchOffset)
    : SYSTEM_PROMPT(topic, distribution, batchCount, batchOffset)
}


async function callOpenAI(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode, batchCount: number, batchOffset: number): Promise<string> {
  const model = config.model || 'gpt-4o'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: getPrompt(mode, topic, distribution, batchCount, batchOffset) }],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

async function callAnthropic(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode, batchCount: number, batchOffset: number): Promise<string> {
  const model = config.model || 'claude-sonnet-4-20250514'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: getPrompt(mode, topic, distribution, batchCount, batchOffset) }]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${err}`)
  }

  const data = await response.json()
  return data.content[0].text
}

async function callGoogle(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode, batchCount: number, batchOffset: number): Promise<string> {
  const model = config.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: getPrompt(mode, topic, distribution, batchCount, batchOffset) }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Google error: ${err}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

export async function callOllama(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode, batchCount: number, batchOffset: number): Promise<string> {
  const model = normalizeOllamaModel(config.model || 'gemma4:31b')

  const baseUrl = config.ollamaUrl.replace(/\/+$/, '')
  const isCloud = baseUrl.includes('ollama.com')
  
  // Use Ollama's OpenAI-compatible endpoint for Cloud, native /api/chat for local.
  const url = isCloud ? '/ollama-cloud-api/v1/chat/completions' : `${baseUrl}/api/chat`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  // OpenAI-compatible body vs Native Ollama body
  const requestBody = isCloud ? {
    model,
    messages: [{ role: 'user', content: getPrompt(mode, topic, distribution, batchCount, batchOffset) }],
    stream: false,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  } : {
    model,
    messages: [{ role: 'user', content: getPrompt(mode, topic, distribution, batchCount, batchOffset) }],
    stream: false,
    format: 'json',
    options: {
      temperature: 0.7,
      num_predict: 8192,
      num_ctx: 16384
    }
  }



  console.log(`[Ollama] Fetching (${isCloud ? 'Cloud' : 'Local'}):`, url)
  console.log('[Ollama] Model:', model)

  let response: Response
  try {
    // Increase client-side timeout to 10 minutes for large generations
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000)

    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    const message = isTimeout ? 'Request timed out (took over 10 minutes)' : (err instanceof Error ? err.message : 'Unknown error')
    throw new Error(
      `Cannot reach Ollama at ${url}.\n\n` +
      `Error: ${message}\n\n` +
      `Check:\n` +
      `1. Your API key is valid and set in settings (⚙ icon)\n` +
      `2. The model "${model}" is available in your Ollama account\n` +
      `3. The URL "${config.ollamaUrl}" is correct`
    )
  }

  if (!response.ok) {
    const errText = await response.text()
    let errorDetail = errText
    try {
      const errJson = JSON.parse(errText)
      errorDetail = errJson.error || errJson.message || errText
      if (errJson.ref) errorDetail += ` (ref: ${errJson.ref})`
    } catch {}
    throw new Error(`Ollama API error (${response.status}): ${errorDetail}`)
  }

  const data = await response.json()
  console.log('[Ollama] Response data:', data)

  // Handle both OpenAI-compatible (Cloud) and Native (Local) formats
  const content = isCloud 
    ? data.choices?.[0]?.message?.content 
    : data.message?.content

  if (!content) {
    throw new Error(`Unexpected Ollama response format: ${JSON.stringify(data).slice(0, 300)}`)
  }

  return content
}

export async function generateMCQs(
  topic: string,
  distribution: DifficultyDistribution,
  mode: QuizMode = 'topic'
): Promise<MCQQuestion[]> {
  const provider = localStorage.getItem('mcq_provider') || 'ollama'
  const apiKey = localStorage.getItem('mcq_api_key') || ''
  let model = localStorage.getItem('mcq_api_model') || 'gemma4:31b'
  let ollamaUrl = localStorage.getItem('mcq_ollama_url') || 'https://ollama.com'

  // Keep old saved values working, but persist the canonical model name.
  if (model.endsWith('-cloud')) {
    model = normalizeOllamaModel(model)
    localStorage.setItem('mcq_api_model', model)
  }

  if (ollamaUrl === 'http://localhost:11434' && provider === 'ollama') {
    ollamaUrl = 'https://ollama.com'
    localStorage.setItem('mcq_ollama_url', ollamaUrl)
  }

  const config: MCQCreatorConfig = { provider, apiKey, model, ollamaUrl }
  const totalNeeded = distribution.easy + distribution.medium + distribution.hard
  const BATCH_SIZE = 5
  const allQuestions: MCQQuestion[] = []
  
  for (let offset = 0; offset < totalNeeded; offset += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, totalNeeded - offset)
    console.log(`[Generator] Batch ${offset / BATCH_SIZE + 1}: ${batchCount}/${totalNeeded}`)
    
    let batchResponse: string
    switch (provider) {
      case 'openai': batchResponse = await callOpenAI(topic, distribution, config, mode, batchCount, offset); break
      case 'anthropic': batchResponse = await callAnthropic(topic, distribution, config, mode, batchCount, offset); break
      case 'google': batchResponse = await callGoogle(topic, distribution, config, mode, batchCount, offset); break
      case 'ollama': batchResponse = await callOllama(topic, distribution, config, mode, batchCount, offset); break
      default: throw new Error(`Unknown provider: ${provider}`)
    }

    const batchQuestions = parseMCQResponse(batchResponse)
    if (batchQuestions.length > 0) {
      allQuestions.push(...batchQuestions)
    }
  }

  if (allQuestions.length === 0) {
    throw new Error('No questions generated. Check connectivity.')
  }

  return allQuestions
}
