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
