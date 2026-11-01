const fs = require('node:fs');
const file = '/app/backend/server.cjs';
let s = fs.readFileSync(file, 'utf8');
const start = s.indexOf('async function invokeOpenAI(');
const end = s.indexOf('async function doAssistant(', start);
if (start < 0 || end < 0) throw new Error('Could not locate AI provider functions.');
const replacement = [
"async function invokeOpenAI(messages, opts={}) {",
"  const endpoint=String(process.env.BUK_QWEN_URL||'').trim();",
"  const token=String(process.env.BUK_QWEN_TOKEN||'').trim();",
"  if(!endpoint||!token) throw Object.assign(new Error('اتصال Qwen بالكمبيوتر غير مكتمل. اضبط BUK_QWEN_URL وBUK_QWEN_TOKEN على Render.'),{status:503});",
"  const prompt=messages.map(m => (m.role==='system'?'تعليمات':m.role==='assistant'?'المساعد':'المستخدم') + ': ' + String(m.content||'')).join(String.fromCharCode(10)+String.fromCharCode(10));",
"  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:prompt}),signal:AbortSignal.timeout(90000)});",
"  const data=await response.json().catch(()=>({}));",
"  if(!response.ok) throw Object.assign(new Error(data.error||'تعذر الاتصال بـ Qwen على الكمبيوتر.'),{status:502});",
"  const reply=String(data.reply||data.response||'').trim();",
"  if(!reply) throw Object.assign(new Error('عاد Qwen برد فارغ.'),{status:502});",
"  return reply;",
"}",
""
].join('\n');
s=s.slice(0,start)+replacement+s.slice(end);
const a=s.indexOf("  if(action==='transcribe'){");
const b=s.indexOf("  if(action==='speak')",a);
if(a>=0 && b>a) s=s.slice(0,a)+[
"  if(action==='transcribe'){",
"    return res.status(501).json({error:'التفريغ الصوتي عبر الخادم غير متاح حاليًا؛ استخدم التعرف الصوتي المحلي في الجهاز.'});",
"  }",
""
].join('\n')+s.slice(b);
fs.writeFileSync(file,s);
console.log('Patched BUK AI provider to Qwen without nested template literals.');
