# MCQ Trainer

A lightweight, interactive MCQ (Multiple Choice Question) trainer that takes a topic and helps you learn through AI-generated quizzes. Logs all questions and your answers in YAML format.

## Features

- **AI-Powered MCQ Generation** — Enter any topic and generate 3–20 multiple-choice questions using OpenAI, Anthropic Claude, Google Gemini, or local Ollama models
- **Interactive Quiz Mode** — Answer questions one at a time with instant feedback, correct answer highlighting, and explanations
- **YAML Logging** — Every question, your answer, and the correct answer are logged in structured YAML format
- **Export & Download** — Download your quiz session as a YAML file for later review
- **Score Summary** — See your final score with a question-by-question breakdown
- **Bring Your Own Key** — Configure your own API keys (or use free local Ollama models)

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

1. Click the **⚙ Settings** icon to configure your LLM provider and API key
2. Enter a topic (e.g. "JavaScript closures", "World War II", "Photosynthesis")
3. Select the number of questions (3, 5, 10, 15, or 20)
4. Click **Generate MCQs**
5. Answer each question — correct answers turn green, incorrect turn red
6. Read the explanation for each question
7. At the end, review your score and **Export YAML** to download the log

## Supported LLM Providers

| Provider      | Setup                          |
|---------------|--------------------------------|
| OpenAI        | API key + model name           |
| Anthropic     | API key + model name           |
| Google        | API key + model name           |
| Ollama        | Local URL (no API key needed)  |

## Project Structure

```
src/
├── components/
│   ├── TopicInput.tsx     # Topic input + settings
│   ├── MCQCreator.tsx     # AI API integration for MCQ generation
│   └── MCQList.tsx        # Interactive quiz UI + scoring
├── utils/
│   └── yamlExporter.ts    # YAML formatting + download + localStorage
├── types.ts               # TypeScript interfaces
├── App.tsx                # Main app
├── main.tsx               # Entry point
└── index.css              # TailwindCSS styles
```

## Tech Stack

- React 18 + TypeScript
- Vite 5
- TailwindCSS
- js-yaml
- lucide-react (icons)

## License

MIT
