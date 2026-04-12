import { QuizSession, QuizState, QuestionAnswer, MCQQuestion } from '../types'
import { buildAllSessionsMarkdown, downloadMarkdown } from './mdExporter'

const QUIZ_STATE_KEY = 'mcq_quiz_state'
const SESSIONS_KEY = 'mcq_sessions'

export function saveQuizState(state: QuizState): void {
  localStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(state))
}

export function loadQuizState(): QuizState | null {
  const raw = localStorage.getItem(QUIZ_STATE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as QuizState
  } catch {
    return null
  }
}

export function clearQuizState(): void {
  localStorage.removeItem(QUIZ_STATE_KEY)
}

export function finalizeSession(state: QuizState): QuizSession {
  const endTime = Date.now()
  const totalTime = Math.round((endTime - state.timerStart) / 1000) +
    Object.values(state.perQuestionTimers).reduce((a, b) => a + b, 0)

  // Compute per-question time for any unanswered questions
  const allAnswers = state.answers.map(a => ({ ...a }))

  const session: QuizSession = {
    session_id: `session-${Date.now()}`,
    topic: state.topic,
    tags: extractAllTags(state.questions),
    total_questions: state.questions.length,
    answers: allAnswers,
    started_at: state.startedAt,
    completed_at: new Date().toISOString(),
    total_time_seconds: totalTime
  }

  saveSession(session)
  clearQuizState()

  // Auto-download cumulative MD file after every session
  autoDownloadAllSessions()

  return session
}

export function autoDownloadAllSessions(): void {
  try {
    const sessions = getAllSessions()
    if (sessions.length === 0) return
    const md = buildAllSessionsMarkdown(sessions)
    downloadMarkdown(md, 'mcq-history.md')
  } catch (err) {
    console.error('[sessionManager] Auto-export failed:', err)
  }
}

function extractAllTags(questions: MCQQuestion[]): string[] {
  const tagSet = new Set<string>()
  for (const q of questions) {
    for (const t of q.tags) tagSet.add(t)
  }
  return Array.from(tagSet)
}

export function saveSession(session: QuizSession): void {
  const sessions = getAllSessions()
  sessions.push(session)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function getAllSessions(): QuizSession[] {
  const raw = localStorage.getItem(SESSIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as QuizSession[]
  } catch {
    return []
  }
}

export function clearAllSessions(): void {
  localStorage.removeItem(SESSIONS_KEY)
}

export function recordAnswer(
  state: QuizState,
  questionIndex: number,
  question: MCQQuestion,
  selectedOptionIndex: number
): QuizState {
  const now = Date.now()
  const timeSpent = Math.round((now - state.timerStart) / 1000) -
    (state.perQuestionTimers[questionIndex] || 0)
  const finalTime = Math.max(timeSpent, 1)

  const answer: QuestionAnswer = {
    question_id: question.question_id,
    question_text: question.question_text,
    options: question.options,
    correct_answer: question.options[question.correct_answer],
    user_answer: question.options[selectedOptionIndex],
    is_correct: selectedOptionIndex === question.correct_answer,
    explanation: question.explanation,
    difficulty: question.difficulty,
    tags: question.tags,
    time_spent_seconds: finalTime,
    timestamp: new Date().toISOString(),
    flagged: state.flaggedIndices.includes(questionIndex)
  }

  const existingAnswerIdx = state.answers.findIndex(a => a.question_id === question.question_id)
  let newAnswers = [...state.answers]
  if (existingAnswerIdx >= 0) {
    newAnswers[existingAnswerIdx] = answer
  } else {
    newAnswers.push(answer)
  }

  return {
    ...state,
    answers: newAnswers,
    perQuestionTimers: { ...state.perQuestionTimers, [questionIndex]: finalTime },
    timerStart: now
  }
}

export function toggleFlag(state: QuizState, index: number): QuizState {
  const flagged = new Set(state.flaggedIndices)
  if (flagged.has(index)) flagged.delete(index)
  else flagged.add(index)

  return { ...state, flaggedIndices: Array.from(flagged) }
}
