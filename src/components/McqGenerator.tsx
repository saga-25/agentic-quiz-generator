import { MCQQuestion, Difficulty, DifficultyDistribution, QuizMode } from '../types'

interface MCQCreatorConfig {
  provider: string
  apiKey: string
  model: string
  ollamaUrl: string
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

const SYSTEM_PROMPT = (topic: string, distribution: DifficultyDistribution) => {
  const total = distribution.easy + distribution.medium + distribution.hard
  return `You are a world-class assessment designer with deep expertise in "${topic}". Your goal is to create ${total} multiple-choice questions that rigorously test genuine understanding, not just rote memorization.

Difficulty breakdown (STRICT — follow exactly):
- ${distribution.easy} EASY questions: Test fundamental definitions, core terminology, and basic recall. A well-prepared beginner should answer these correctly.
- ${distribution.medium} MEDIUM questions: Test application and analysis. Require connecting two or more concepts, interpreting scenarios, or applying rules to novel situations.
- ${distribution.hard} HARD questions: Test synthesis, edge cases, and expert-level reasoning. Require deep domain knowledge, multi-step logic, or distinguishing between subtly different concepts that are commonly confused.

Question Design Principles:
1. PLAUSIBLE DISTRACTORS — Every wrong option must represent a real misconception, a common error, or a closely related but incorrect concept. Never use obviously absurd or throwaway options.
2. CLEAR STEM — Each question stem must be unambiguous and self-contained. Avoid double negatives and trick wording.
3. BALANCED OPTION LENGTH — All four options should be similar in length and grammatical structure. The correct answer should never be conspicuously longer or more detailed.
4. ONE BEST ANSWER — There must be exactly one defensibly correct answer. If a topic is debatable, frame the question to make the intended answer unambiguous (e.g., "According to standard theory...").
5. DIVERSE COGNITIVE LEVELS — Within each difficulty tier, mix question types: definition, comparison, cause-effect, scenario-based, "which of the following is NOT", ordering/sequencing, and best-practice questions.
6. RICH EXPLANATIONS — Each explanation must: (a) state why the correct answer is right with supporting reasoning, AND (b) briefly explain why each distractor is wrong.

Return ONLY a valid JSON array (no surrounding text) with this structure:
[
  {
    "question_id": "q-001",
    "question_text": "A clear, well-formed question?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "difficulty": "easy",
    "tags": ["subtopic-1", "subtopic-2"],
    "explanation": "Option A is correct because [reason]. Option B is wrong because [reason]. Option C is wrong because [reason]. Option D is wrong because [reason]."
  }
]

Field rules:
- question_id: sequential "q-001", "q-002", etc.
- correct_answer: 0-based index (0, 1, 2, or 3). Distribute correct answers roughly evenly across positions — do NOT cluster them.
- difficulty: first ${distribution.easy} are "easy", next ${distribution.medium} are "medium", last ${distribution.hard} are "hard"
- tags: 2-4 lowercase hyphenated subtopic tags
- options: exactly 4 per question
- Do NOT include any text before or after the JSON array`
}

const INTERVIEWER_SYSTEM_PROMPT = (projectDetails: string, distribution: DifficultyDistribution) => {
  const total = distribution.easy + distribution.medium + distribution.hard
  return `You are a world-class senior technical interviewer and specialized assessment designer. Your goal is to create ${total} conceptual multiple-choice questions that an interviewer would ask to test a candidate's deep mastery of the following project:

PROJECT DETAILS:
"${projectDetails}"

Guidelines for Interview-Ready Questions:
1. FOCUS ON CONCEPTUAL MASTERY: Do not ask about trivial syntax unless it's critical to the architecture. Ask about the "Why" and "How" of the technologies mentioned (e.g., why choose LangGraph over a simple chain, how MCP solves integration hurdles, the implications of PII redaction in RAG).
2. CHALLENGE THE CANDIDATE: Questions should simulate a high-stakes technical interview. They should probe for understanding of trade-offs, scalability, security, and lifecycle management (LLMOps).
3. PEDAGOGICAL EXPLANATIONS: Explanations must be descriptive and professional. 
   - Start by clearly stating the core architectural or conceptual principle.
   - Use a "mentor's voice" to explain the logic.
   - Provide a "Why not?" section for distractors, explaining the specific trade-off or misconception they represent.

Difficulty breakdown (STRICT — follow exactly):
- ${distribution.easy} EASY (Conceptual Foundations): Basic definitions of tools used, understanding the primary goals, and straightforward application of mentioned principles.
- ${distribution.medium} MEDIUM (Analytical Depth): Questions about trade-offs, comparison of alternative approaches, and standard production challenges.
- ${distribution.hard} HARD (Architectural Synthesis): Synthesis of multiple concepts, complex edge cases (e.g., hallucination mitigation in multi-agent systems, PII leaks), and advanced troubleshooting in production environments.

Return ONLY a valid JSON array with this structure:
[
  {
    "question_id": "q-001",
    "question_text": "A sophisticated, scenario-based interview question?",
    "options": ["Plausible but sub-optimal approach", "The architecturally sound correct answer", "Common industry misconception", "Alternative tool that doesn't fit the context"],
    "correct_answer": 1,
    "difficulty": "medium",
    "tags": ["architecture", "security", "scalability", "llmops"],
    "explanation": "Start with the 'What': [Principal explanation]. Then the 'Why': [Pedagogical reasoning]. Finally, the 'Contrast': [Why distractors are less optimal or represent specific risks]."
  }
]

Field rules:
- question_id: sequential "q-001", "q-002", etc.
- correct_answer: 0-based index. Randomize the position.
- difficulty: first ${distribution.easy} are "easy", next ${distribution.medium} are "medium", last ${distribution.hard} are "hard"
- tags: 2-4 lowercase hyphenated tags related to interviewing (e.g., 'system-design', 'llm-security')
- Do NOT include any text before or after the JSON array`
}

function getPrompt(mode: QuizMode, topic: string, distribution: DifficultyDistribution): string {
  return mode === 'interviewer'
    ? INTERVIEWER_SYSTEM_PROMPT(topic, distribution)
    : SYSTEM_PROMPT(topic, distribution)
}


async function callOpenAI(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode): Promise<string> {
  const model = config.model || 'gpt-4o'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: getPrompt(mode, topic, distribution) }],
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

async function callAnthropic(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode): Promise<string> {
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
      messages: [{ role: 'user', content: getPrompt(mode, topic, distribution) }]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${err}`)
  }

  const data = await response.json()
  return data.content[0].text
}

async function callGoogle(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode): Promise<string> {
  const model = config.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: getPrompt(mode, topic, distribution) }] }],
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

async function callOllama(topic: string, distribution: DifficultyDistribution, config: MCQCreatorConfig, mode: QuizMode): Promise<string> {
  const model = config.model || 'gemma4:31b'

  const baseUrl = config.ollamaUrl.replace(/\/+$/, '')

  // Use Vite proxy to avoid CORS when hitting Ollama Cloud from browser
  const isCloud = baseUrl.includes('ollama.com')
  const url = isCloud
    ? '/ollama-cloud-api/api/chat'
    : `${baseUrl}/api/chat`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  // Use the native Ollama `/api/chat` endpoint and format
  const requestBody = {
    model,
    messages: [{ role: 'user', content: getPrompt(mode, topic, distribution) }],
    stream: false,
    format: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question_id: { type: 'string' },
          question_text: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correct_answer: { type: 'integer' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          tags: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' }
        },
        required: ['question_text', 'options', 'correct_answer', 'explanation']
      }
    },
    options: {
      temperature: 0.7,
      num_predict: 8192, // Ensure enough tokens for 30-50 questions
      num_ctx: 16384     // Increase context window for large prompt + large output
    }
  }

  console.log('[Ollama] Fetching:', url)
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
      `2. The model "${model}" is available in your Ollama Cloud account\n` +
      `3. The URL "${config.ollamaUrl}" is correct (should be https://ollama.com for cloud)`
    )
  }

  if (!response.ok) {
    const errText = await response.text()
    let detail = errText
    try { detail = JSON.parse(errText).error || errText } catch {}
    throw new Error(`Ollama API error (${response.status}): ${detail}`)
  }

  const data = await response.json()
  console.log('[Ollama] Response keys:', Object.keys(data))

  let content: string | undefined = data.message?.content

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
  let model = localStorage.getItem('mcq_api_model') || 'gemma4:31b-cloud'
  let ollamaUrl = localStorage.getItem('mcq_ollama_url') || 'https://ollama.com'

  // Migration: Fix old defaults in localStorage
  if (model === 'gpt-oss:120b-cloud' || model === 'gemma4:31b') {
    model = 'gemma4:31b-cloud'
    localStorage.setItem('mcq_api_model', model)
  }

  // Fix stale localhost URL in localStorage from old sessions
  if (ollamaUrl === 'http://localhost:11434' && provider === 'ollama') {
    ollamaUrl = 'https://ollama.com'
    localStorage.setItem('mcq_ollama_url', ollamaUrl)
  }

  const config: MCQCreatorConfig = { provider, apiKey, model, ollamaUrl }

  let response: string
  switch (provider) {
    case 'openai': response = await callOpenAI(topic, distribution, config, mode); break
    case 'anthropic': response = await callAnthropic(topic, distribution, config, mode); break
    case 'google': response = await callGoogle(topic, distribution, config, mode); break
    case 'ollama': response = await callOllama(topic, distribution, config, mode); break
    default: throw new Error(`Unknown provider: ${provider}`)
  }

  const questions = parseMCQResponse(response)
  if (questions.length === 0) {
    throw new Error('Failed to parse MCQ questions from AI response. Please try again.')
  }

  return questions
}
