const fs = require('node:fs');
const file = '/app/backend/server.cjs';
let s = fs.readFileSync(file, 'utf8');
const start = s.indexOf('async function invokeOpenAI(');
const end = s.indexOf('async function doAssistant(', start);
if (start < 0 || end < 0) throw new Error('Could not locate AI provider functions.');
const replacement = [
"async function invokeOpenAI(messages, opts={}) {",
"  const key=String(process.env.OPENAI_API_KEY||'').trim();",
"  if(!key) throw Object.assign(new Error('ميزة المساعد تحتاج ضبط OPENAI_API_KEY في إعدادات Render.'),{status:503});",
"  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages,temperature:0.4,...opts}),signal:AbortSignal.timeout(60000)});",
"  const data=await response.json().catch(()=>({}));",
"  if(!response.ok) throw Object.assign(new Error(data.error?.message||'فشل الاتصال بمزود الذكاء الاصطناعي.'),{status:502});",
"  return data.choices?.[0]?.message?.content||'';",
"}",
""
].join('\n');
s=s.slice(0,start)+replacement+s.slice(end);
fs.writeFileSync(file,s);
console.log('Restored OpenAI provider for My BUKI, chat and translation.');


const speechFile = '/app/src/lib/speech.js';
let speech = fs.readFileSync(speechFile, 'utf8');
const oldSpeak = [
  'export function speakOnDevice(text, lang, gender) {',
  '  const voice = deviceVoice(lang, gender);',
  '  if (!voice) return false;',
  '  try {',
  '    const utterance = new window.SpeechSynthesisUtterance(String(text));',
  '    utterance.voice = voice;',
  "    utterance.lang = voice.lang || 'ar-SA';",
  '    utterance.rate = 0.95;',
  '    window.speechSynthesis.cancel();',
  '    window.speechSynthesis.speak(utterance);',
  '    return true;',
  '  } catch {',
  '    return false;',
  '  }',
  '}'
].join('\n');
const newSpeak = [
  'export function speakOnDevice(text, lang, gender) {',
  "  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;",
  '  try {',
  '    const synthesis = window.speechSynthesis;',
  '    const voice = deviceVoice(lang, gender);',
  '    const utterance = new window.SpeechSynthesisUtterance(String(text));',
  "    utterance.lang = voice?.lang || (baseLang(lang) === 'ar' ? 'ar-SA' : String(lang || 'en-US'));",
  '    if (voice) utterance.voice = voice;',
  '    utterance.rate = 0.95;',
  '    utterance.volume = 1;',
  '    utterance.pitch = 1;',
  '    synthesis.cancel();',
  '    synthesis.speak(utterance);',
  '    return true;',
  '  } catch {',
  '    return false;',
  '  }',
  '}'
].join('\n');
if (speech.includes(oldSpeak)) {
  speech = speech.replace(oldSpeak, newSpeak);
  fs.writeFileSync(speechFile, speech);
  console.log('Patched My BUKI device speech fallback only.');
} else if (speech.includes(newSpeak)) {
  console.log('My BUKI speech fallback already patched.');
} else {
  throw new Error('Could not safely locate My BUKI speech function.');
}


const dictationFile = '/app/src/lib/dictation.js';
const dictationSource = `/** تحويل الكلام إلى نص داخل المتصفح — مع تهيئة موثوقة وإعادة محاولة تلقائية واحدة. */

const Speech = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition);

export function dictationSupported() {
  return Boolean(Speech());
}

export function startDictation({ lang = 'ar-SA', onPartial, onFinal, onError, onStart } = {}) {
  const Engine = Speech();
  if (!Engine) {
    if (onError) onError('unsupported');
    return { stop: () => {} };
  }

  let activeEngine = null;
  let settled = false;
  let stopped = false;
  let attempts = 0;
  let retryTimer = null;
  let startTimer = null;
  let finalText = '';

  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (startTimer) clearTimeout(startTimer);
    retryTimer = null;
    startTimer = null;
  };

  const finish = (value) => {
    if (settled || stopped) return;
    settled = true;
    clearTimers();
    if (onFinal) onFinal(String(value || '').trim());
  };

  const fail = (code) => {
    if (settled || stopped) return;
    clearTimers();
    if (attempts < 2 && ['no-speech', 'network', 'start-failed', 'start-timeout', 'empty-result'].includes(code)) {
      retryTimer = setTimeout(() => startAttempt(), 450);
      return;
    }
    settled = true;
    if (onError) onError(code);
  };

  const startAttempt = () => {
    if (settled || stopped) return;
    attempts += 1;
    finalText = '';
    let engine;
    try {
      engine = new Engine();
      activeEngine = engine;
      engine.lang = lang;
      engine.continuous = false;
      engine.interimResults = true;
      engine.maxAlternatives = 1;

      engine.onstart = () => {
        if (startTimer) clearTimeout(startTimer);
        startTimer = null;
        if (onStart) onStart();
      };

      engine.onresult = (event) => {
        let interim = '';
        let completed = '';
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result && result[0] ? result[0].transcript : '';
          if (result && result.isFinal) completed += transcript;
          else interim += transcript;
        }
        if (completed.trim()) {
          finalText = completed.trim();
          finish(finalText);
        } else if (interim.trim() && onPartial) {
          onPartial(interim.trim());
        }
      };

      engine.onerror = (event) => {
        const code = String((event && event.error) || 'unknown');
        if (code === 'aborted' && stopped) return;
        fail(code);
      };

      engine.onend = () => {
        if (settled || stopped) return;
        if (finalText) finish(finalText);
        else fail('empty-result');
      };

      startTimer = setTimeout(() => {
        if (!settled && !stopped && activeEngine === engine) {
          try { engine.abort(); } catch {}
          fail('start-timeout');
        }
      }, 5000);

      engine.start();
    } catch {
      fail('start-failed');
    }
  };

  startAttempt();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimers();
      try {
        if (activeEngine) activeEngine.stop();
      } catch {}
    }
  };
}
`;
fs.writeFileSync(dictationFile, dictationSource);
console.log('Patched My BUKI first-command dictation retry only.');
