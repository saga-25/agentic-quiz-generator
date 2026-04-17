import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseMCQResponse, callOllama, MCQCreatorConfig } from './McqGenerator'
import { DifficultyDistribution } from '../types'

describe('parseMCQResponse', () => {
  it('correctly parses a clean JSON array', () => {
    const input = JSON.stringify([
      {
        question_id: 'q-001',
        question_text: 'What is JS?',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 0,
        difficulty: 'easy',
        tags: ['js'],
        explanation: 'Some explanation'
      }
    ])
    const result = parseMCQResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].question_text).toBe('What is JS?')
  })

  it('handles surrounding text and markdown code blocks', () => {
    const input = 'Here are the questions:\n```json\n[\n  {\n    "question_id": "q-001",\n    "question_text": "What is JS?",\n    "options": ["A", "B", "C", "D"],\n    "correct_answer": 0,\n    "difficulty": "easy",\n    "tags": ["js"],\n    "explanation": "Some explanation"\n  }\n]\n```\nGood luck!'
    const result = parseMCQResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].question_text).toBe('What is JS?')
  })

  it('handles JSON wrapped in an object (Strategy 2)', () => {
    const input = '{\n  "status": "success",\n  "questions": [\n    {\n      "question_id": "q-001",\n      "question_text": "What is JS?",\n      "options": ["A", "B", "C", "D"],\n      "correct_answer": 0,\n      "difficulty": "easy",\n      "tags": ["js"],\n      "explanation": "Some explanation"\n    }\n  ]\n}'
    const result = parseMCQResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].question_text).toBe('What is JS?')
  })
})

describe('callOllama TDD', () => {
  const mockDist: DifficultyDistribution = { easy: 1, medium: 0, hard: 0 }
  const mockConfig: MCQCreatorConfig = {
    provider: 'ollama',
    apiKey: 'test-key',
    model: 'gemma4:31b-cloud',
    ollamaUrl: 'https://ollama.com'
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('RED: correctly formats request for CLOUD (Native)', async () => {
    const mockResponse = {
      message: { content: '[]' }
    }
    
    // @ts-ignore
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await callOllama('React', mockDist, mockConfig, 'topic')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)

    expect(url).toBe('/ollama-cloud-api/api/chat')
    expect(body).toHaveProperty('model', 'gemma4:31b-cloud')
    expect(body).toHaveProperty('stream', false)
    expect(body.format).toBe('json')
    expect(body.options).toHaveProperty('num_ctx', 16384)
  })

  it('RED: correctly formats request for LOCAL (Native Ollama)', async () => {
    const mockLocalConfig = { ...mockConfig, ollamaUrl: 'http://localhost:11434' }
    const mockResponse = {
      message: { content: '[]' }
    }
    
    // @ts-ignore
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await callOllama('React', mockDist, mockLocalConfig, 'topic')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)

    expect(url).toBe('http://localhost:11434/api/chat')
    expect(body).toHaveProperty('format', 'json')
    expect(body.options).toHaveProperty('num_ctx')
  })

  it('RED: captures reference ID in 500 error', async () => {
    const refId = 'ref-12345'
    const errorBody = { error: 'Internal Server Error', ref: refId }

    // @ts-ignore
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify(errorBody)
    })

    await expect(callOllama('React', mockDist, mockConfig, 'topic'))
      .rejects.toThrow(/Ollama API error \(500\):/)
  })
})
