export type Difficulty = 'easy' | 'medium' | 'hard'

export interface DifficultyDistribution {
  easy: number
  medium: number
  hard: number
}

export interface MCQQuestion {
  question_id: string
  question_text: string
  options: string[]
  correct_answer: number // 0-based index
  difficulty: Difficulty
  tags: string[]
  explanation: string
}

export interface QuestionAnswer {
  question_id: string
  question_text: string
  options: string[]
  correct_answer: string // the text of the correct option
  user_answer: string    // the text of the user's selected option
  is_correct: boolean
  explanation: string
  difficulty: Difficulty
  tags: string[]
  time_spent_seconds: number
  timestamp: string
  flagged: boolean
}

export interface QuizSession {
  session_id: string
  topic: string
  tags: string[]
  total_questions: number
  answers: QuestionAnswer[]
  started_at: string
  completed_at: string | null
  total_time_seconds: number
}

export interface QuizState {
  questions: MCQQuestion[]
  topic: string
  currentIndex: number
  answers: QuestionAnswer[]
  flaggedIndices: number[]
  startedAt: string
  timerStart: number
  perQuestionTimers: Record<number, number> // index -> seconds elapsed
  isComplete: boolean
}
