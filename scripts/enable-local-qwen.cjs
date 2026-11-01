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
