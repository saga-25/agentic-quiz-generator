import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, X, ChevronLeft, ChevronRight, Flag, Clock, Bookmark } from 'lucide-react'
import { MCQQuestion, QuizState, QuizMode } from '../types'
import { recordAnswer, toggleFlag, saveQuizState } from '../utils/sessionManager'

interface QuizViewProps {
  questions: MCQQuestion[]
  topic: string
  mode: QuizMode
  initialState?: QuizState
  onFinish: (state: QuizState) => void
}

export default function QuizView({ questions, topic, mode, initialState, onFinish }: QuizViewProps) {
  const [state, setState] = useState<QuizState>(() => {
    if (initialState) return initialState
    return {
      questions,
      topic,
      mode,
      currentIndex: 0,
      answers: [],
      flaggedIndices: [],
      startedAt: new Date().toISOString(),
      timerStart: Date.now(),
      perQuestionTimers: {},
      isComplete: false
    }
  })

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const current = questions[state.currentIndex]
  const answeredCount = state.answers.length
  const progressPercent = (answeredCount / questions.length) * 100

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Auto-save on every state change
  useEffect(() => {
    saveQuizState(state)
  }, [state])

  const formatTime = useCallback((total: number) => {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [])

  const handleSelect = (optionIndex: number) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(optionIndex)
    setShowExplanation(true)

    const newState = recordAnswer(state, state.currentIndex, current, optionIndex)
    setState(newState)
  }

  const handleNext = () => {
    if (state.currentIndex + 1 >= questions.length) {
      onFinish(state)
      return
    }
    setCurrentIndex(state.currentIndex + 1)
  }

  const handlePrev = () => {
    if (state.currentIndex > 0) {
      setCurrentIndex(state.currentIndex - 1)
    }
  }

  const setCurrentIndex = (index: number) => {
    // Check if this question was already answered
    const existingAnswer = state.answers.find(a => {
      const q = questions[index]
      return a.question_id === q.question_id
    })

    setSelectedAnswer(existingAnswer ? questions[index].options.indexOf(existingAnswer.user_answer) : null)
    setShowExplanation(!!existingAnswer)
    setState(prev => ({ ...prev, currentIndex: index, timerStart: Date.now() }))
  }

  const handleFlag = () => {
    const newState = toggleFlag(state, state.currentIndex)
    setState(newState)
  }

  const isFlagged = state.flaggedIndices.includes(state.currentIndex)
  const isAnswered = selectedAnswer !== null
  const isCorrect = isAnswered && selectedAnswer === current.correct_answer

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header: Timer + Progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-mono">{formatTime(elapsedSeconds)}</span>
        </div>
        <span className="text-sm text-gray-400">
          {answeredCount}/{questions.length} answered
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">
          Question {state.currentIndex + 1} of {questions.length}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            current.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
            current.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
            'bg-red-500/10 text-red-400'
          }`}>
            {current.difficulty}
          </span>
          {current.tags.length > 0 && (
            <span className="text-xs text-gray-500">{current.tags.join(' · ')}</span>
          )}
        </div>
      </div>

      {/* Question card */}
      <div className={`p-6 bg-gray-900 border rounded-2xl mb-4 transition-colors ${
        isAnswered
          ? isCorrect ? 'border-green-500/50' : 'border-red-500/50'
          : 'border-gray-700'
      }`}>
        <h2 className="text-xl font-semibold text-white mb-6">{current.question_text}</h2>

        <div className="space-y-3">
          {current.options.map((option, i) => {
            let style = 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50 cursor-pointer'
            let icon = null

            if (isAnswered) {
              if (i === current.correct_answer) {
                style = 'border-green-500 bg-green-500/10'
                icon = <Check className="w-5 h-5 text-green-400 shrink-0" />
              } else if (i === selectedAnswer) {
                style = 'border-red-500 bg-red-500/10'
                icon = <X className="w-5 h-5 text-red-400 shrink-0" />
              } else {
                style = 'border-gray-700 opacity-50'
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={isAnswered}
                className={`w-full text-left p-4 border rounded-xl transition-all flex items-center justify-between gap-3 ${style}`}
              >
                <span className="text-white">{option}</span>
                {icon}
              </button>
            )
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && current.explanation && (
        <div className={`p-4 border rounded-xl mb-4 ${
          isCorrect
            ? 'bg-green-500/10 border-green-500/30 text-green-200'
            : 'bg-red-500/10 border-red-500/30 text-red-200'
        }`}>
          <p className="text-sm">
            <span className="font-semibold">{isCorrect ? 'Correct! ' : 'Incorrect. '}</span>
            {current.explanation}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePrev}
          disabled={state.currentIndex === 0}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <button
          onClick={handleFlag}
          className={`px-4 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5 ${
            isFlagged
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <Flag className="w-4 h-4" />
          {isFlagged ? 'Flagged' : 'Flag'}
        </button>

        <div className="flex-1" />

        {state.flaggedIndices.length > 0 && (
          <div className="flex items-center gap-1 text-yellow-400 text-sm">
            <Bookmark className="w-3.5 h-3.5" />
            {state.flaggedIndices.length}
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={!isAnswered}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          {state.currentIndex + 1 >= questions.length ? 'Finish' : 'Next'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
