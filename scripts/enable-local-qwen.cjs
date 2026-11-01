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


// Deterministic Arabic clock parsing: do not let the language model round or shift explicit hours.
const assistantFile = '/app/backend/server.cjs';
let backend = fs.readFileSync(assistantFile, 'utf8');
const helper = "\nfunction parseExplicitArabicClock(input) {\n  const digitMap = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};\n  const text = String(input || '').replace(/[٠-٩۰-۹]/g, c => digitMap[c]).replace(/[ًٌٍَُِّْـ]/g, '').replace(/[،,:]/g, ' ').toLowerCase();\n  const markerMatch = text.match(/(?:على|عند)?\\s*(?:الساعة|الساعه)/);\n  if (!markerMatch) return null;\n  const tail = text.slice(markerMatch.index + markerMatch[0].length).trim();\n  const words = tail.split(/\\s+/).filter(Boolean);\n  const values = {\n    'صفر':0,'واحد':1,'واحدة':1,'وحدة':1,'اثنان':2,'اثنين':2,'ثنتين':2,'ثلاثة':3,'ثلاث':3,\n    'أربعة':4,'اربعة':4,'أربع':4,'اربع':4,'خمسة':5,'خمس':5,'ستة':6,'ست':6,'سبعة':7,'سبع':7,\n    'ثمانية':8,'ثمان':8,'تسعة':9,'تسع':9,'عشرة':10,'عشر':10,'أحدعشر':11,'احدعشر':11,\n    'أحد':11,'إحدى':11,'احدى':11,'حدعش':11,'حداش':11,'اثنا عشر':12,'اثني عشر':12,'اثنعش':12,'اثناش':12,\n    'ثلاثة عشر':13,'أربعة عشر':14,'خمسة عشر':15,'ستة عشر':16,'سبعة عشر':17,'ثمانية عشر':18,'تسعة عشر':19,\n    'عشرون':20,'عشرين':20,'ثلاثون':30,'ثلاثين':30,'أربعون':40,'اربعون':40,'أربعين':40,'اربعين':40,\n    'خمسون':50,'خمسين':50,'ستون':60,'ستين':60,'سبعون':70,'سبعين':70,'ثمانون':80,'ثمانين':80,'تسعون':90,'تسعين':90\n  };\n  const numberAt = (arr, index) => {\n    if (index >= arr.length) return null;\n    const rawToken = arr[index];\n    const token = Object.prototype.hasOwnProperty.call(values,rawToken) ? rawToken : rawToken.replace(/^و/,'');\n    if (/^\\d{1,2}$/.test(token)) return {value:Number(token),count:1};\n    const pair = arr.slice(index,index+2).join(' ');\n    if (Object.prototype.hasOwnProperty.call(values,pair)) return {value:values[pair],count:2};\n    if (!Object.prototype.hasOwnProperty.call(values,token)) return null;\n    let value = values[token], count = 1;\n    if (arr[index+1] === 'و' && Object.prototype.hasOwnProperty.call(values,arr[index+2])) {\n      value += values[arr[index+2]]; count = 3;\n    } else if (arr[index+1] && Object.prototype.hasOwnProperty.call(values,arr[index+1])) {\n      const next = values[arr[index+1]];\n      if ((value < 20 && next >= 20) || (value >= 20 && next < 10)) { value += next; count = 2; }\n    }\n    return {value,count};\n  };\n  const hourPart = numberAt(words,0);\n  if (!hourPart || hourPart.value < 1 || hourPart.value > 24) return null;\n  let rest = words.slice(hourPart.count);\n  if (rest[0] === 'و') rest = rest.slice(1);\n  const minutePart = numberAt(rest,0);\n  if (!minutePart || minutePart.value < 0 || minutePart.value > 59) return null;\n  let hour = hourPart.value;\n  const period = (words.join(' ').match(/مساء|مسائا|ليلا|ليل|pm|صباح|صباحا|صباحاً|am/) || [])[0] || '';\n  if (/مساء|مسائا|ليلا|ليل|pm/.test(period) && hour < 12) hour += 12;\n  if (/صباح|am/.test(period) && hour === 12) hour = 0;\n  return {hour, minute:minutePart.value, period:period || null};\n}\n";
if (!backend.includes('function parseExplicitArabicClock(')) {
  const anchor = 'async function doAssistant(req,res,body,user){';
  if (!backend.includes(anchor)) throw new Error('Cannot find My BUKI assistant handler.');
  backend = backend.replace(anchor, helper + '\n' + anchor);
}
const oldPersona = /const persona=isMyBuki\s*\?\s*\`[\s\S]*?\`\s*:\s*'أنت BUK AI، المساعد الذكي داخل تطبيق BUK\. أجب بالعربية الواضحة والمباشرة\.';/;
const newPersona = "const persona=isMyBuki\n      ? `أنت My Buki، مساعد شخصي عربي. الوقت المحلي للمستخدم: ${String(body.local_now||'غير محدد')}؛ المنطقة الزمنية: ${String(body.tz_name||'غير محددة')}؛ offset_minutes=${String(body.offset_minutes??'غير محدد')}. ساعد في الأسئلة والملاحظات والتذكيرات. أعد JSON فقط بالشكل {\"reply\":\"نص الرد\",\"action\":\"none\"} أو عند طلب ضبط تذكير واضح {\"reply\":\"تأكيد مختصر\",\"action\":\"create_reminder\",\"title\":\"عنوان قصير\",\"at\":\"تاريخ ISO 8601 مع المنطقة الزمنية أو offset\",\"repeat\":\"none|daily|weekly|monthly\"}. مهم جدًا: انقل الساعة والدقائق التي قالها المستخدم حرفيًا دون زيادة ساعة أو تقريبها أو تبديلها؛ «عشرة وخمسة وخمسون» تعني 10:55 بالضبط، ولا تجعلها 11:55. لا تحوّل الوقت إلى توقيت UTC عند كتابة at؛ أرفق offset المنطقة الزمنية للمستخدم. لا تنشئ تذكيرًا إلا إذا ذكر المستخدم وقتًا واضحًا. لا تخترع موعدًا؛ عند غموض الوقت اسأل سؤالًا واجعل action=none. يجب أن يكون at في المستقبل.`\n      : 'أنت BUK AI، المساعد الذكي داخل تطبيق BUK. أجب بالعربية الواضحة والمباشرة.';";
if (oldPersona.test(backend)) backend = backend.replace(oldPersona,newPersona);
else if (!backend.includes('«عشرة وخمسة وخمسون» تعني 10:55')) throw new Error('Cannot safely update My BUKI time instructions.');
const oldAt = 'const at=new Date(result.at);';
const newAt = "const at=new Date(result.at);\n          const explicitClock=parseExplicitArabicClock(text);\n          if(explicitClock && Number.isFinite(at.getTime())){\n            const offset=Number.isFinite(Number(body.offset_minutes))?Number(body.offset_minutes):0;\n            const localInstant=new Date(at.getTime()-offset*60000);\n            at.setTime(Date.UTC(localInstant.getUTCFullYear(),localInstant.getUTCMonth(),localInstant.getUTCDate(),explicitClock.hour,explicitClock.minute,0,0)-offset*60000);\n          }";
if (backend.includes(oldAt)) backend = backend.replace(oldAt,newAt);
else if (!backend.includes('const explicitClock=parseExplicitArabicClock(text);')) throw new Error('Cannot safely patch reminder time validation.');
fs.writeFileSync(assistantFile, backend);
console.log('Patched My BUKI explicit Arabic hour/minute parsing and timezone-safe reminder correction.');
