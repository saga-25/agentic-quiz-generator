# MCQ Trainer

MCQ Trainer is a high-fidelity assessment platform that leverages large language models to generate rigorous multiple-choice assessments. The application provides granular control over question difficulty, real-time performance telemetry, and automated reporting.

## Features

### AI Assessment Generation
* **Multi-Provider Integration**: Support for OpenAI, Anthropic, Google Gemini, and Ollama Cloud.
* **Deterministic Parsing**: Validated JSON schema processing ensures consistent question formatting and reliable metadata extraction.
* **Comprehensive Explanations**: Every generated question includes detailed reasoning for the correct response and clarifying distractors.

### Assessment Configuration
* **Extended Question Sets**: Configurable assessment lengths between 30 and 50 questions for deep-domain testing.
* **Granular Difficulty Control**: User-defined distribution sliders for precise allocation of easy, medium, and hard difficulty tiers.
* **Automated Tagging**: Context-aware subtopic tagging for advanced longitudinal performance analysis.

### User Interface and Experience
* **Session Persistence**: Automatic state management via local storage allows for the resumption of incomplete assessments.
* **Performance Telemetry**: Per-question timing and total session duration tracking.
* **Review System**: Built-in flagging mechanism to mark specific questions for post-assessment review.
* **Real-time Feedback**: Instant corrective actions and pedagogical explanations provided immediately upon selection.

### Analytical Reporting
* **Performance Breakdown**: Multidimensional analysis of accuracy across difficulty levels and subtopic tags.
* **Markdown Export**: Automated generation of comprehensive session reports in Markdown format for study integration.
* **Local History**: Persistent chronological log of all completed assessment sessions.

---

## Technical Specifications

* **Frontend Framework**: React 18
* **Build System**: Vite
* **Programming Language**: TypeScript
* **Styling**: TailwindCSS
* **Icons**: Lucide React
* **Persistence**: Browser LocalStorage

---

## Installation and Setup

### Prerequisites
* Node.js version 18.0 or higher
* npm (Node Package Manager)

### Local Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/saga-25/agentic-quiz-generator.git
   cd agentic-quiz-generator
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Execute the application**:
   ```bash
   npm run dev
   ```

---

## Configuration

The application is designed for client-side execution and does not require server-side configuration files. API keys and provider settings are managed through the internal settings interface:

1. **LLM Provider**: Select from OpenAI, Anthropic, Google, or Ollama.
2. **Model Identifier**: Input the specific model string (e.g., `gpt-4o`, `claude-3-5-sonnet-latest`).
3. **API Keys**: Keys are stored securely in local storage and are only utilized for direct communication with the selected provider's API.
4. **Ollama URL**: Define custom endpoints for local or private Ollama deployments.

---

## License

This project is licensed under the MIT License.
