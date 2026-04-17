import fetch from 'node-fetch';

const API_KEY = process.env.MCQ_API_KEY;
const MODEL = process.env.MCQ_MODEL || 'gemma4:31b-cloud';
const BASE_URL = 'https://ollama.com';

async function testEndpoint(name: string, path: string, body: any) {
  console.log(`\n--- Testing ${name} (${path}) ---`);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      console.log('Response JSON (snippet):', JSON.stringify(data).slice(0, 200));
      if (data.error) console.error('Error Ref:', data.ref || 'N/A');
    } catch {
      console.log('Response Text (snippet):', text.slice(0, 200));
    }
  } catch (err) {
    console.error(`Request failed: ${err.message}`);
  }
}

async function run() {
  if (!API_KEY) {
    console.error('Error: MCQ_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // 1. Test Native API
  await testEndpoint('Native API', '/api/chat', {
    model: MODEL,
    messages: [{ role: 'user', content: 'Say hello' }],
    stream: false,
    format: 'json'
  });

  // 2. Test OpenAI Compatible API (v1)
  await testEndpoint('OpenAI Compatible (v1)', '/v1/chat/completions', {
    model: MODEL,
    messages: [{ role: 'user', content: 'Say hello' }],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  // 3. Test OpenAI Compatible API (api/v1) - just in case
  await testEndpoint('OpenAI Compatible (api/v1)', '/api/v1/chat/completions', {
    model: MODEL,
    messages: [{ role: 'user', content: 'Say hello' }]
  });
}

run();
