const STORAGE_KEY = 'chat_in_english_api_key';
const SETTINGS_KEY = 'chat_in_english_settings';

const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const clearKeyBtn = document.getElementById('clearKeyBtn');
const modelSelect = document.getElementById('modelSelect');
const scenarioSelect = document.getElementById('scenarioSelect');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const correctionBox = document.getElementById('correctionBox');
const coachNote = document.getElementById('coachNote');
const voiceBtn = document.getElementById('voiceBtn');
const speakReplyBtn = document.getElementById('speakReplyBtn');
const themeToggle = document.getElementById('themeToggle');
const newChatBtn = document.getElementById('newChatBtn');

const state = {
  apiKey: localStorage.getItem(STORAGE_KEY) || '',
  messages: [],
  latestReply: '',
  recognition: null,
  isListening: false,
};

function setStatus(text) {
  const existing = document.querySelector('.status');
  if (existing) existing.remove();

  const status = document.createElement('div');
  status.className = 'status';
  status.innerHTML = '<span class="dot"></span><span>' + text + '</span>';
  const chatPanel = document.querySelector('.chat-panel');
  chatPanel.appendChild(status);
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (saved.model) modelSelect.value = saved.model;
  if (saved.scenario) scenarioSelect.value = saved.scenario;
  if (saved.theme === 'dark') document.body.classList.add('dark');
  if (saved.theme === 'light') document.body.classList.remove('dark');
}

function saveSettings() {
  const settings = {
    model: modelSelect.value,
    scenario: scenarioSelect.value,
    theme: document.body.classList.contains('dark') ? 'dark' : 'light',
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function showApiKey() {
  apiKeyInput.value = state.apiKey;
}

function saveApiKey() {
  const key = apiKeyInput.value.trim();
  state.apiKey = key;
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
    setStatus('API key saved in your browser.');
  } else {
    localStorage.removeItem(STORAGE_KEY);
    setStatus('API key cleared.');
  }
}

function clearApiKey() {
  state.apiKey = '';
  apiKeyInput.value = '';
  localStorage.removeItem(STORAGE_KEY);
  setStatus('API key removed.');
}

function getScenarioPrompt(scenario) {
  const base = `You are a friendly English conversation teacher and native-speaker coach. Keep the tone natural, encouraging, and helpful. Speak at a level that is suitable for learners. Do NOT sound robotic. `;

  const scenarioConfig = {
    'daily-life': 'Practice everyday conversations about school, work, family, hobbies, and social plans.',
    'coffee-shop': 'Roleplay a barista and customer in a coffee shop conversation. Keep it practical and polite.',
    'travel': 'Roleplay travel and airport situations, asking for directions, ordering food, and checking in.',
    'job-interview': 'Roleplay a professional job interview. Encourage confidence and clear answers.',
    'classroom': 'Roleplay classroom discussion and speaking practice in a university or language classroom.'
  };

  return `${base}${scenarioConfig[scenario] || scenarioConfig['daily-life']}\n\nRespond in this format as valid JSON only:\n{\n  "response": "your natural reply to the user in English",\n  "correction": "the best corrected or more natural version of the user sentence or a useful phrase",\n  "coachNote": "a short explanation of grammar, tone, or usage"\n}`;
}

function parseModelResponse(rawText) {
  const cleaned = rawText.trim();
  const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/i);
  const jsonText = match ? match[1] : cleaned;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    return {
      response: rawText,
      correction: 'Try again with a clearer sentence.',
      coachNote: 'The model returned a plain response instead of structured JSON.'
    };
  }
}

function buildPromptFromHistory() {
  const context = state.messages.map((message) => `${message.role}: ${message.text}`).slice(-12).join('\n');
  const userText = userInput.value.trim();
  const fallback = userText || 'Please help me practice speaking English.';
  return `Conversation context:\n${context}\n\nUser says: ${fallback}`;
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  const apiKey = state.apiKey;
  if (!apiKey) {
    setStatus('Please add your Gemini API key first.');
    apiKeyInput.focus();
    return;
  }

  const userMessage = { role: 'user', text };
  state.messages.push(userMessage);
  renderMessages();
  userInput.value = '';
  sendBtn.disabled = true;
  setStatus('Sending to Gemini...');

  const requestBody = {
    system_instruction: {
      parts: [{ text: getScenarioPrompt(scenarioSelect.value) }],
    },
    contents: [{
      role: 'user',
      parts: [{ text: buildPromptFromHistory() }],
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelSelect.value}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Gemini request failed.');
    }

    const rawText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || '';
    const data = parseModelResponse(rawText);
    const aiText = data.response || 'I am ready to help you practice.';
    const correctedText = data.correction || 'No correction generated.';
    const coachText = data.coachNote || 'Keep practicing!';

    state.messages.push({ role: 'ai', text: aiText });
    state.latestReply = aiText;
    correctionBox.textContent = correctedText;
    correctionBox.classList.remove('empty-state');
    coachNote.textContent = coachText;
    coachNote.classList.remove('empty-state');
    renderMessages();
    setStatus('AI reply ready.');
  } catch (error) {
    const message = error.message || 'Unknown error';
    state.messages.push({ role: 'ai', text: `Sorry, I couldn't generate a response. Error: ${message}` });
    state.latestReply = `Sorry, I couldn't generate a response. Error: ${message}`;
    renderMessages();
    correctionBox.textContent = 'Please check your API key and model name.';
    correctionBox.classList.remove('empty-state');
    coachNote.textContent = 'If the key is invalid or rate limited, new requests will fail until it is fixed.';
    coachNote.classList.remove('empty-state');
    setStatus('Request failed.');
  } finally {
    sendBtn.disabled = false;
  }
}

function renderMessages() {
  const items = state.messages.map((message) => {
    const roleLabel = message.role === 'user' ? 'You' : 'Coach';
    return `
      <div class="message ${message.role}">
        <span class="meta">${roleLabel}</span>
        <div>${message.text}</div>
      </div>
    `;
  }).join('');

  chatMessages.innerHTML = items || '<div class="message ai"><span class="meta">Coach</span><div>Hello! Let’s practice English together. Ask me anything.</div></div>';
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus('Your browser does not support speech recognition.');
    return;
  }

  if (!state.recognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      userInput.value = transcript;
    };

    recognition.onend = () => {
      state.isListening = false;
      voiceBtn.textContent = '🎤';
    };

    recognition.onerror = () => {
      state.isListening = false;
      voiceBtn.textContent = '🎤';
      setStatus('Microphone error. Please try again.');
    };

    state.recognition = recognition;
  }

  if (state.isListening) {
    state.recognition.stop();
    state.isListening = false;
    voiceBtn.textContent = '🎤';
    return;
  }

  state.recognition.start();
  state.isListening = true;
  voiceBtn.textContent = '🛑';
  setStatus('Listening...');
}

function speakLatestReply() {
  if (!state.latestReply) {
    setStatus('No AI reply yet.');
    return;
  }

  if (!('speechSynthesis' in window)) {
    setStatus('Your browser does not support speech synthesis.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(state.latestReply);
  utterance.lang = 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  setStatus('Reading the latest reply aloud...');
}

function handleQuickPrompt(event) {
  const prompt = event.currentTarget.dataset.prompt;
  if (prompt) {
    userInput.value = prompt;
    userInput.focus();
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  saveSettings();
}

function newChat() {
  state.messages = [];
  state.latestReply = '';
  correctionBox.textContent = 'AI corrections will appear here.';
  correctionBox.classList.add('empty-state');
  coachNote.textContent = 'Your teacher feedback will appear here.';
  coachNote.classList.add('empty-state');
  renderMessages();
  setStatus('New chat started.');
}

saveKeyBtn.addEventListener('click', saveApiKey);
clearKeyBtn.addEventListener('click', clearApiKey);
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
voiceBtn.addEventListener('click', startRecognition);
speakReplyBtn.addEventListener('click', speakLatestReply);
scenarioSelect.addEventListener('change', saveSettings);
modelSelect.addEventListener('change', saveSettings);
themeToggle.addEventListener('click', toggleTheme);
newChatBtn.addEventListener('click', newChat);
document.querySelectorAll('.prompt-chip').forEach((chip) => chip.addEventListener('click', handleQuickPrompt));

showApiKey();
loadSettings();
renderMessages();
