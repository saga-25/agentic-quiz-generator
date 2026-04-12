import { useState, useEffect, useCallback } from 'react'
import TopicInput from './components/TopicInput'
import QuizView from './components/QuizView'
import ResultsView from './components/ResultsView'
import { generateMCQs } from './components/McqGenerator'
import { MCQQuestion, QuizState, QuizSession, DifficultyDistribution } from './types'
import { loadQuizState, clearQuizState, finalizeSession } from './utils/sessionManager'

type AppView = 'quiz' | 'results' | 'home'

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home')
  const [questions, setQuestions] = useState<MCQQuestion[]>([])
  const [topic, setTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionResult, setSessionResult] = useState<QuizSession | null>(null)
  const [resumeState, setResumeState] = useState<QuizState | null>(null)
  const [resumeTopic, setResumeTopic] = useState('')
  const [autoExported, setAutoExported] = useState(false)

  // Check for incomplete session on mount
  useEffect(() => {
    const saved = loadQuizState()
    if (saved && saved.questions.length > 0) {
      setResumeState(saved)
      setResumeTopic(saved.topic)
    }
  }, [])

  const handleGenerate = async (newTopic: string, _count: number, distribution: DifficultyDistribution) => {
    setIsLoading(true)
    setError(null)
    setTopic(newTopic)

    try {
      const generated = await generateMCQs(newTopic, distribution)
      setQuestions(generated)
      setView('quiz')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResume = useCallback(() => {
    if (resumeState) {
      setQuestions(resumeState.questions)
      setTopic(resumeState.topic)
      setView('quiz')
    }
  }, [resumeState])

  const handleDiscardResume = useCallback(() => {
    clearQuizState()
    setResumeState(null)
    setResumeTopic('')
  }, [])

  const handleFinish = useCallback((state: QuizState) => {
    const session = finalizeSession(state)
    setSessionResult(session)
    setAutoExported(true)
    setView('results')
  }, [])

  const handleReset = useCallback(() => {
    setQuestions([])
    setTopic('')
    setSessionResult(null)
    setAutoExported(false)
    setView('home')
  }, [])

  if (view === 'quiz' && questions.length > 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="py-8">
          <QuizView
            questions={questions}
            topic={topic}
            initialState={resumeState || undefined}
            onFinish={handleFinish}
          />
        </div>
      </div>
    )
  }

  if (view === 'results' && sessionResult) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="py-8">
          <ResultsView
            session={sessionResult}
            onReset={handleReset}
            autoExported={autoExported}
          />
        </div>
      </div>
    )
  }

  // Home view
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="py-8">
        {/* Resume Banner */}
        {resumeState && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-300 font-medium text-sm">Incomplete session found</p>
                <p className="text-gray-400 text-xs mt-1">{resumeTopic} — {resumeState.answers.length}/{resumeState.questions.length} answered</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDiscardResume}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleResume}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Resume
                </button>
              </div>
            </div>
          </div>
        )}

        <TopicInput onGenerate={handleGenerate} isLoading={isLoading} />

        {error && (
          <div className="mt-6 max-w-2xl mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
