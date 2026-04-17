import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callOllama, MCQCreatorConfig } from './McqGenerator'
import { DifficultyDistribution } from '../types'

describe('callOllama Endpoint logic (TDD)', () => {
  const mockDist: DifficultyDistribution = { easy: 1, medium: 0, hard: 0 }
  
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('Cloud Provider: uses /v1/chat/completions and OpenAI-compatible payload', async () => {
    const mockConfig: MCQCreatorConfig = {
      provider: 'ollama',
      apiKey: 'test-key',
      model: 'gemma4:31b-cloud',
      ollamaUrl: 'https://ollama.com'
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '[]' } }]
      })
    } as any)

    await callOllama('ML', mockDist, mockConfig, 'topic', 1, 0)

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)

    // Verify correct cloud path
    expect(url).toBe('/ollama-cloud-api/v1/chat/completions')
    
    // Verify OpenAI-compatible formatting
    expect(body).toHaveProperty('response_format', { type: 'json_object' })
    expect(body).not.toHaveProperty('format') // format is native-only
    expect(body.messages[0]).toHaveProperty('role')
  })

  it('Local Provider: uses /api/chat and Native Ollama payload', async () => {
    const mockConfig: MCQCreatorConfig = {
      provider: 'ollama',
      apiKey: '',
      model: 'llama3',
      ollamaUrl: 'http://localhost:11434'
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: '[]' }
      })
    } as any)

    await callOllama('ML', mockDist, mockConfig, 'topic', 1, 0)

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)

    // Verify native path
    expect(url).toBe('http://localhost:11434/api/chat')
    
    // Verify native formatting
    expect(body).toHaveProperty('format', 'json')
    expect(body).not.toHaveProperty('response_format')
  })
})
