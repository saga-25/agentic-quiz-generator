import { describe, it, expect } from 'vitest'
import { parseMCQResponse } from './McqGenerator'

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
