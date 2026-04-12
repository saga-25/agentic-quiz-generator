import { QuizSession, QuestionAnswer, Difficulty } from '../types'

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}m ${secs}s`
}

function difficultyBadge(d: Difficulty): string {
  const map: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }
  return map[d]
}

function buildSessionTable(answers: QuestionAnswer[]): string {
  const header = '| # | Question | Your Answer | Correct Answer | Result | Time | Difficulty |\n'
  const separator = '|---|----------|-------------|----------------|--------|------|------------|\n'

  const rows = answers.map((a, i) => {
    const result = a.is_correct ? '✅' : '❌'
    const q = a.question_text.length > 60 ? a.question_text.slice(0, 60) + '...' : a.question_text
    const userAns = a.user_answer.length > 30 ? a.user_answer.slice(0, 30) + '...' : a.user_answer
    const correctAns = a.correct_answer.length > 30 ? a.correct_answer.slice(0, 30) + '...' : a.correct_answer
    return `| ${i + 1} | ${q} | ${userAns} | ${correctAns} | ${result} | ${formatTime(a.time_spent_seconds)} | ${difficultyBadge(a.difficulty)} ${a.difficulty} |`
  }).join('\n')

  return header + separator + rows
}

function buildDifficultyBreakdown(answers: QuestionAnswer[]): string {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard']
  const lines = difficulties.map(d => {
    const filtered = answers.filter(a => a.difficulty === d)
    const correct = filtered.filter(a => a.is_correct).length
    return `- **${d.charAt(0).toUpperCase() + d.slice(1)}**: ${correct}/${filtered.length} (${filtered.length > 0 ? Math.round((correct / filtered.length) * 100) : 0}%)`
  })
  return lines.join('\n')
}

function buildTagBreakdown(answers: QuestionAnswer[]): string {
  const tagMap = new Map<string, { total: number; correct: number }>()
  for (const a of answers) {
    for (const tag of a.tags) {
      const entry = tagMap.get(tag) || { total: 0, correct: 0 }
      entry.total++
      if (a.is_correct) entry.correct++
      tagMap.set(tag, entry)
    }
  }

  if (tagMap.size === 0) return '_No tags available_'

  return Array.from(tagMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([tag, stats]) => `- **${tag}**: ${stats.correct}/${stats.total} (${Math.round((stats.correct / stats.total) * 100)}%)`)
    .join('\n')
}

function buildFlaggedQuestions(answers: QuestionAnswer[]): string {
  const flagged = answers.filter(a => a.flagged)
  if (flagged.length === 0) return '_None_'

  return flagged
    .map((a, i) => `${i + 1}. **${a.question_text}**\n   - Your answer: ${a.user_answer}\n   - Correct: ${a.correct_answer}`)
    .join('\n\n')
}

function buildSessionMarkdown(session: QuizSession): string {
  const correctCount = session.answers.filter(a => a.is_correct).length
  const accuracy = session.total_questions > 0
    ? Math.round((correctCount / session.total_questions) * 100)
    : 0

  return `
## 📝 ${session.topic}

| Metric | Value |
|--------|-------|
| **Date** | ${new Date(session.started_at).toLocaleString()} |
| **Total Questions** | ${session.total_questions} |
| **Correct** | ${correctCount} |
| **Accuracy** | ${accuracy}% |
| **Time Taken** | ${formatTime(session.total_time_seconds)} |
| **Avg Time/Question** | ${formatTime(Math.round(session.total_time_seconds / Math.max(session.total_questions, 1)))} |

### Results

${buildSessionTable(session.answers)}

### Breakdown by Difficulty

${buildDifficultyBreakdown(session.answers)}

### Breakdown by Tag

${buildTagBreakdown(session.answers)}

### Flagged for Review

${buildFlaggedQuestions(session.answers)}

---
`
}

export function buildAllSessionsMarkdown(sessions: QuizSession[]): string {
  // Most recent first
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )

  const header = `# MCQ Trainer — Quiz History\n\n_Total sessions: ${sessions.length}_\n\n---`

  const body = sorted.map(s => buildSessionMarkdown(s)).join('\n')

  return header + '\n' + body + '\n'
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
