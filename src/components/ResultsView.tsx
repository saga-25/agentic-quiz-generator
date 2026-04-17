import { useState } from 'react'
import { RotateCcw, Download, Check, X, Flag } from 'lucide-react'
import { QuizSession, Difficulty } from '../types'
import { buildAllSessionsMarkdown, downloadMarkdown } from '../utils/mdExporter'
import { getAllSessions } from '../utils/sessionManager'

interface ResultsViewProps {
  session: QuizSession
  onReset: () => void
  autoExported: boolean
}

export default function ResultsView({ session, onReset, autoExported }: ResultsViewProps) {
  const [showExported, setShowExported] = useState(false)

  const correctCount = session.answers.filter(a => a.is_correct).length
  const accuracy = session.total_questions > 0
    ? Math.round((correctCount / session.total_questions) * 100)
    : 0

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}m ${s}s`
  }

  // Difficulty breakdown
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard']
  const diffBreakdown = difficulties.map(d => {
    const filtered = session.answers.filter(a => a.difficulty === d)
    const correct = filtered.filter(a => a.is_correct).length
    return { difficulty: d, correct, total: filtered.length }
  })

  // Tag breakdown
  const tagMap = new Map<string, { total: number; correct: number }>()
  for (const a of session.answers) {
    for (const tag of a.tags) {
      const entry = tagMap.get(tag) || { total: 0, correct: 0 }
      entry.total++
      if (a.is_correct) entry.correct++
      tagMap.set(tag, entry)
    }
  }
  const tagBreakdown = Array.from(tagMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([tag, stats]) => ({ tag, ...stats }))

  const flaggedAnswers = session.answers.filter(a => a.flagged)

  const handleExport = () => {
    const sessions = getAllSessions()
    const md = buildAllSessionsMarkdown(sessions)
    downloadMarkdown(md, `mcq-history-${Date.now()}.md`)
    setShowExported(true)
    setTimeout(() => setShowExported(false), 3000)
  }

  // Animated score circle
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference - (accuracy / 100) * circumference

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Score Header */}
      <div className="p-8 bg-gray-900 border border-gray-700 rounded-2xl text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Quiz Complete!</h2>
        <p className="text-gray-400 text-sm mb-6">{session.topic}</p>

        {/* Animated circle */}
        <div className="inline-flex items-center justify-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#1f2937" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={accuracy >= 70 ? '#22c55e' : accuracy >= 40 ? '#eab308' : '#ef4444'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{accuracy}%</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-2xl font-bold text-green-400">{correctCount}</p>
            <p className="text-xs text-gray-400">Correct</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{session.total_questions - correctCount}</p>
            <p className="text-xs text-gray-400">Incorrect</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-400">{formatTime(session.total_time_seconds)}</p>
            <p className="text-xs text-gray-400">Time</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export MD
          </button>
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            New Quiz
          </button>
        </div>
        {autoExported && (
          <p className="text-green-400 text-sm mt-3">✓ Session report auto-downloaded</p>
        )}
        {showExported && !autoExported && (
          <p className="text-green-400 text-sm mt-3">Exported successfully!</p>
        )}
      </div>

      {/* Difficulty Breakdown */}
      <div className="p-5 bg-gray-900 border border-gray-700 rounded-xl mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">By Difficulty</h3>
        <div className="space-y-2">
          {diffBreakdown.map(d => (
            <div key={d.difficulty} className="flex items-center justify-between">
              <span className={`text-sm ${
                d.difficulty === 'easy' ? 'text-green-400' :
                d.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {d.difficulty.charAt(0).toUpperCase() + d.difficulty.slice(1)}
              </span>
              <div className="flex items-center gap-3 flex-1 mx-4">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${d.total > 0 ? (d.correct / d.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-300 w-16 text-right">{d.correct}/{d.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tag Breakdown */}
      {tagBreakdown.length > 0 && (
        <div className="p-5 bg-gray-900 border border-gray-700 rounded-xl mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">By Tag</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {tagBreakdown.map(t => (
              <div key={t.tag} className="flex items-center justify-between py-1 border-b border-gray-800 last:border-0">
                <span className="text-sm font-medium text-gray-300">
                  {t.tag}
                </span>
                <span className="text-sm font-mono text-gray-400">
                  {t.correct}/{t.total} ({Math.round((t.correct / t.total) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flagged */}
      {flaggedAnswers.length > 0 && (
        <div className="p-5 bg-gray-900 border border-gray-700 rounded-xl mb-4">
          <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flag className="w-4 h-4" /> Flagged for Review
          </h3>
          <div className="space-y-2">
            {flaggedAnswers.map((a, i) => (
              <div key={i} className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-white text-sm font-medium">{a.question_text}</p>
                <p className="text-gray-400 text-xs mt-1">
                  Your answer: <span className={a.is_correct ? 'text-green-400' : 'text-red-400'}>{a.user_answer}</span>
                  {!a.is_correct && <span className="text-green-400 ml-2">· Correct: {a.correct_answer}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Answers */}
      <div className="p-5 bg-gray-900 border border-gray-700 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">All Questions</h3>
        <div className="space-y-2">
          {session.answers.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
              {a.is_correct
                ? <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                : <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{a.question_text}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{a.user_answer}</span>
                  <span>·</span>
                  <span>{formatTime(a.time_spent_seconds)}</span>
                  {a.flagged && <Flag className="w-3 h-3 text-yellow-400" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
