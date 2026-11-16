const STORAGE_KEY = 'chat_in_english_api_key';
const SETTINGS_KEY = 'chat_in_english_settings';
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const scenarioSelect = document.getElementById('scenarioSelect');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatForm = document.getElementById('chatForm');
const chatMessages = document.getElementById('chatMessages');
const correctionBox = document.getElementById('correctionBox');
const coachNote = document.getElementById('coachNote');
const voiceBtn = document.getElementById('voiceBtn');
const speakCorrectionBtn = document.getElementById('speakCorrectionBtn');
const themeToggle = document.getElementById('themeToggle');
const newChatBtn = document.getElementById('newChatBtn');

const state = {
  apiKey: localStorage.getItem(STORAGE_KEY) || '',
  messages: [],
  latestCorrection: '',
  recognition: null,
  isListening: false,
};

const scenarios = {
  'daily-life': 'Have a relaxed everyday conversation. Be a friendly conversation partner.',
  restaurant: 'Roleplay as a friendly restaurant server. Help the learner practice getting a table, ordering food, and asking for the bill.',
  hotel: 'Roleplay as a welcoming hotel receptionist. Help the learner practice checking in, asking about amenities, and requesting help.',
  'job-interview': 'Roleplay as a supportive job interviewer. Ask realistic interview questions and help the learner give confident answers.',
};

function setStatus(message, isError = false) {
  let status = document.getElementById('appStatus');
  if (!status) {
    status = document.createElement('p');
    status.id = 'appStatus';
    status.className = 'status';
    status.setAttribute('role', 'status');
    document.querySelector('.chat-panel').append(status);
  }
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (saved.model && modelSelect.querySelector(`option[value="${CSS.escape(saved.model)}"]`)) modelSelect.value = saved.model;
    if (saved.scenario && scenarioSelect.querySelector(`option[value="${CSS.escape(saved.scenario)}"]`)) scenarioSelect.value = saved.scenario;
    if (saved.theme === 'dark') document.body.classList.add('dark');
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
  themeToggle.textContent = document.body.classList.contains('dark') ? '☀' : '☾';
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    model: modelSelect.value,
    scenario: scenarioSelect.value,
    theme: document.body.classList.contains('dark') ? 'dark' : 'light',
  }));
}

function saveApiKey() {
  state.apiKey = apiKeyInput.value.trim();
  if (!state.apiKey) {
    localStorage.removeItem(STORAGE_KEY);
    setStatus('No API key saved. Paste your key to start practicing.', true);
    return;
  }
  localStorage.setItem(STORAGE_KEY, state.apiKey);
  setStatus('API key saved in this browser. You’re ready to practice.');
}

function clearApiKey() {
  state.apiKey = '';
  apiKeyInput.value = '';
  localStorage.removeItem(STORAGE_KEY);
  setStatus('API key cleared from this browser.');
}

function makeMessage(role, text) {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  const content = document.createElement('div');
  content.className = 'message-content';
  const label = document.createElement('span');
  label.className = 'meta';
  label.textContent = role === 'user' ? 'You' : 'English coach';
  const body = document.createElement('p');
  body.textContent = text;
  content.append(label, body);
  article.append(content);

  if (role === 'ai') {
    const replay = document.createElement('button');
    replay.className = 'message-replay';
    replay.type = 'button';
    replay.textContent = '▶ Listen';
    replay.setAttribute('aria-label', 'Replay this sentence');
    replay.addEventListener('click', () => speak(text));
    article.append(replay);
  }
  return article;
}

function renderMessages() {
  chatMessages.replaceChildren();
  if (state.messages.length === 0) {
    const welcome = makeMessage('ai', 'Hi! I’m your English conversation partner. Choose a roleplay and say hello to get started.');
    chatMessages.append(welcome);
    return;
  }
  state.messages.forEach(({ role, text }) => chatMessages.append(makeMessage(role, text)));
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getSystemInstruction() {
  return `You are a warm, patient English conversation tutor. ${scenarios[scenarioSelect.value] || scenarios['daily-life']}
Reply naturally in English, at a learner-friendly level. Keep your reply concise and ask one relevant follow-up question when it fits. Gently correct the learner's latest English sentence. If it is already natural, say so and offer an optional alternative. Do not shame the learner. Return ONLY valid JSON with exactly these string fields: {"response":"your roleplay reply","correction":"a corrected or more natural version of the learner's sentence","coachNote":"one short explanation or encouragement"}.`;
}

function parseResponse(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(trimmed);
    return {
      response: typeof parsed.response === 'string' ? parsed.response : text,
      correction: typeof parsed.correction === 'string' ? parsed.correction : 'Keep practicing—you’re doing well!',
      coachNote: typeof parsed.coachNote === 'string' ? parsed.coachNote : 'Try using the corrected phrase in your next reply.',
    };
  } catch {
    return { response: text, correction: 'The correction was not available this time.', coachNote: 'Please try another message.' };
  }
}

function extractInteractionText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  return output.flatMap((item) => {
    if (typeof item?.text === 'string') return [item.text];
    if (Array.isArray(item?.content)) return item.content.map((part) => part?.text || '').filter(Boolean);
    return [];
  }).join('\n').trim();
}

async function sendMessage(event) {
  event?.preventDefault();
  const text = userInput.value.trim();
  if (!text || sendBtn.disabled) return;
  state.apiKey = apiKeyInput.value.trim() || state.apiKey;
  if (!state.apiKey) {
    setStatus('Add your Gemini API key above before sending a message.', true);
    apiKeyInput.focus();
    return;
  }
  localStorage.setItem(STORAGE_KEY, state.apiKey);

  const history = [...state.messages, { role: 'user', text }];
  state.messages = history;
  renderMessages();
  userInput.value = '';
  sendBtn.disabled = true;
  setStatus('Thinking…');

  const conversation = history.slice(-16).map((message) => `${message.role === 'ai' ? 'Coach' : 'Learner'}: ${message.text}`).join('\n');

  try {
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': state.apiKey,
      },
      body: JSON.stringify({
        model: modelSelect.value,
        input: conversation,
        system_instruction: getSystemInstruction(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
    const raw = extractInteractionText(payload);
    if (!raw) throw new Error('Gemini returned an empty reply. Try again.');
    const result = parseResponse(raw);
    state.messages.push({ role: 'ai', text: result.response });
    state.latestCorrection = result.correction;
    correctionBox.textContent = result.correction;
    correctionBox.classList.remove('empty-state');
    coachNote.textContent = result.coachNote;
    coachNote.classList.remove('empty-state');
    speakCorrectionBtn.disabled = !result.correction;
    renderMessages();
    setStatus('Reply ready. Tap “Listen” to replay any coach sentence.');
  } catch (error) {
    // Keep the user's message in the transcript so they can retry without losing it.
    state.messages.pop();
    renderMessages();
    setStatus(error.message || 'Could not reach Gemini. Check your connection and API key.', true);
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function speak(text) {
  if (!text) return;
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    setStatus('This browser does not support speech playback.', true);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('Speech recognition is not available in this browser. You can type instead.', true);
    return;
  }
  if (state.isListening) {
    state.recognition?.stop();
    return;
  }
  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'en-US';
  state.recognition.continuous = false;
  state.recognition.interimResults = true;
  state.recognition.onresult = (event) => {
    userInput.value = Array.from(event.results).map((result) => result[0].transcript).join('');
  };
  state.recognition.onerror = (event) => setStatus(`Microphone issue: ${event.error}. You can type instead.`, true);
  state.recognition.onend = () => {
    state.isListening = false;
    voiceBtn.classList.remove('is-listening');
    voiceBtn.textContent = '🎙';
  };
  try {
    state.recognition.start();
    state.isListening = true;
    voiceBtn.classList.add('is-listening');
    voiceBtn.textContent = '■';
    setStatus('Listening… speak in English.');
  } catch {
    setStatus('Could not start the microphone. Check browser permissions.', true);
  }
}

function newChat() {
  state.messages = [];
  state.latestCorrection = '';
  correctionBox.textContent = 'Your improved sentence will appear here after you send a message.';
  correctionBox.classList.add('empty-state');
  coachNote.textContent = 'Tips about grammar, vocabulary, and natural phrasing will show up here.';
  coachNote.classList.add('empty-state');
  speakCorrectionBtn.disabled = true;
  renderMessages();
  setStatus('Fresh conversation started.');
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? '☀' : '☾';
  saveSettings();
}

document.getElementById('saveKeyBtn').addEventListener('click', saveApiKey);
document.getElementById('clearKeyBtn').addEventListener('click', clearApiKey);
chatForm.addEventListener('submit', sendMessage);
userInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});
voiceBtn.addEventListener('click', startRecognition);
speakCorrectionBtn.addEventListener('click', () => speak(state.latestCorrection));
scenarioSelect.addEventListener('change', saveSettings);
modelSelect.addEventListener('change', saveSettings);
themeToggle.addEventListener('click', toggleTheme);
newChatBtn.addEventListener('click', newChat);
document.querySelectorAll('.prompt-chip').forEach((button) => button.addEventListener('click', () => {
  userInput.value = button.dataset.prompt || '';
  userInput.focus();
}));

apiKeyInput.value = state.apiKey;
loadSettings();
renderMessages();
