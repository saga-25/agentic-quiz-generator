import { useState, useMemo } from 'react'
import { Settings, BookOpen } from 'lucide-react'
import { DifficultyDistribution, QuizMode } from '../types'

interface TopicInputProps {
  onGenerate: (topic: string, count: number, distribution: DifficultyDistribution, mode: QuizMode) => void
  isLoading: boolean
}

const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', modelPlaceholder: 'e.g. gpt-4o' },
  { id: 'anthropic', name: 'Anthropic', modelPlaceholder: 'e.g. claude-sonnet-4-20250514' },
  { id: 'google', name: 'Google', modelPlaceholder: 'e.g. gemini-2.0-flash' },
  { id: 'ollama', name: 'Ollama Cloud', modelPlaceholder: 'e.g. gemma4:31b' }
]

const MIN_QUESTIONS = 30
const MAX_QUESTIONS = 50
const DEFAULT_COUNT = 30

function getDefaultDistribution(count: number): DifficultyDistribution {
  const easy = Math.floor(count * 0.4)
  const medium = Math.floor(count * 0.4)
  const hard = count - easy - medium
  return { easy, medium, hard }
}

const diffConfig: Record<keyof DifficultyDistribution, { label: string; color: string; textColor: string; thumbColor: string }> = {
  easy:   { label: 'Easy',   color: 'accent-green-500',   textColor: 'text-green-400',   thumbColor: '#22c55e' },
  medium: { label: 'Medium', color: 'accent-yellow-500',  textColor: 'text-yellow-400',  thumbColor: '#eab308' },
  hard:   { label: 'Hard',   color: 'accent-red-500',     textColor: 'text-red-400',     thumbColor: '#ef4444' }
}

export default function TopicInput({ onGenerate, isLoading }: TopicInputProps) {
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState<QuizMode>('topic')
  const [questionCount, setQuestionCount] = useState(DEFAULT_COUNT)
  const [distribution, setDistribution] = useState<DifficultyDistribution>(() => getDefaultDistribution(DEFAULT_COUNT))
  const [showSettings, setShowSettings] = useState(false)
  const [provider, setProvider] = useState(() => localStorage.getItem('mcq_provider') || 'ollama')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mcq_api_key') || '')
  const [apiModel, setApiModel] = useState(() => {
    const stored = localStorage.getItem('mcq_api_model')
    if (stored === 'gpt-oss:120b-cloud') return 'gemma4:31b'
    return stored || 'gemma4:31b'
  })
  const getStoredUrl = () => {
    const stored = localStorage.getItem('mcq_ollama_url')
    if (stored === 'http://localhost:11434') return 'https://ollama.com'
    return stored || 'https://ollama.com'
  }
  const [ollamaUrl, setOllamaUrl] = useState(getStoredUrl)

  const distTotal = useMemo(() => distribution.easy + distribution.medium + distribution.hard, [distribution])
  const distMatchesCount = distTotal === questionCount

  const handleCountChange = (val: number) => {
    const clamped = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, val))
    setQuestionCount(clamped)
    setDistribution(getDefaultDistribution(clamped))
  }

  const handleDistSliderChange = (level: keyof DifficultyDistribution, newVal: number) => {
    const others = (['easy', 'medium', 'hard'] as (keyof DifficultyDistribution)[])
      .filter(l => l !== level)
      .reduce((sum, l) => sum + distribution[l], 0)

    const clamped = Math.max(0, Math.min(questionCount - others, newVal))
    setDistribution(prev => ({ ...prev, [level]: clamped }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    if (distTotal !== questionCount) return

    localStorage.setItem('mcq_provider', provider)
    localStorage.setItem('mcq_api_key', apiKey)
    localStorage.setItem('mcq_api_model', apiModel)
    localStorage.setItem('mcq_ollama_url', ollamaUrl)

    onGenerate(topic.trim(), questionCount, distribution, mode)
  }

  const currentProvider = LLM_PROVIDERS.find(p => p.id === provider)!

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 mb-4">
          <BookOpen className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">MCQ Trainer</h1>
        <p className="text-gray-400">Enter a topic to generate multiple-choice questions</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Selector */}
        <div className="flex p-1 bg-gray-900 border border-gray-700 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setMode('topic')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === 'topic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            By Topic
          </button>
          <button
            type="button"
            onClick={() => setMode('interviewer')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === 'interviewer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            Interviewer Mode
          </button>
        </div>

        {/* Topic input */}
        <div className="relative">
          {mode === 'topic' ? (
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic (e.g. JavaScript closures, World War II)"
              className="w-full px-5 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
              disabled={isLoading}
            />
          ) : (
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Paste 4-5 lines of your project details or bullet points..."
              className="w-full px-5 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg min-h-[140px] resize-none"
              disabled={isLoading}
            />
          )}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="absolute right-3 bottom-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {showSettings && (
          <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">LLM Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {LLM_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Model</label>
                <input
                  type="text"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  placeholder={currentProvider.modelPlaceholder}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API Key (if required)"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {provider === 'ollama' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ollama URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Question Count */}
        <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
          <label className="block text-sm text-gray-400 mb-2">
            Number of Questions <span className="text-indigo-400">({MIN_QUESTIONS}–{MAX_QUESTIONS})</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={MIN_QUESTIONS}
              max={MAX_QUESTIONS}
              value={questionCount}
              onChange={(e) => handleCountChange(Number(e.target.value))}
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="range"
              min={MIN_QUESTIONS}
              max={MAX_QUESTIONS}
              value={questionCount}
              onChange={(e) => handleCountChange(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm text-gray-500 w-8">{questionCount}</span>
          </div>
        </div>

        {/* Difficulty Distribution Sliders */}
        <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Difficulty Distribution</label>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              distMatchesCount
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {distTotal} / {questionCount}
            </span>
          </div>

          {(['easy', 'medium', 'hard'] as (keyof DifficultyDistribution)[]).map(level => {
            const cfg = diffConfig[level]
            const count = distribution[level]
            const pct = questionCount > 0 ? Math.round((count / questionCount) * 100) : 0

            return (
              <div key={level} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.textColor.replace('text-', 'bg-')}`} />
                    <span className={`text-sm font-semibold capitalize ${cfg.textColor}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={questionCount}
                      value={count}
                      onChange={(e) => handleDistSliderChange(level, Number(e.target.value))}
                      className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={questionCount}
                  value={count}
                  onChange={(e) => handleDistSliderChange(level, Number(e.target.value))}
                  className={`w-full h-2 rounded-full cursor-pointer ${cfg.color}`}
                  style={{
                    background: `linear-gradient(to right, ${cfg.thumbColor} 0%, ${cfg.thumbColor} ${pct}%, #1f2937 ${pct}%, #1f2937 100%)`
                  }}
                />
              </div>
            )
          })}

          {!distMatchesCount && (
            <div className="pt-1">
              <p className="text-xs text-red-400">
                Distribution total ({distTotal}) must equal question count ({questionCount})
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !topic.trim() || !distMatchesCount}
          className="w-full px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors"
        >
          {isLoading ? 'Generating...' : `Generate ${questionCount} MCQs`}
        </button>
      </form>
    </div>
  )
}
