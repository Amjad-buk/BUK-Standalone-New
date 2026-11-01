const fs = require('node:fs');
const file = '/app/backend/server.cjs';
let s = fs.readFileSync(file, 'utf8');
const old = `async function invokeOpenAI(messages, opts={}) {
  const key=String(process.env.OPENAI_API_KEY||'').trim();
  if(!key) throw Object.assign(new Error('ميزة المساعد تحتاج ضبط OPENAI_API_KEY في إعدادات الخادم المستقل.'),{status:503});
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages,temperature:0.4,...opts})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.error?.message||'فشل مزود الذكاء الاصطناعي.'),{status:502});
  return data.choices?.[0]?.message?.content||'';
}`;
const replacement = `async function invokeOpenAI(messages, opts={}) {
  const endpoint=String(process.env.BUK_QWEN_URL||'').trim();
  const token=String(process.env.BUK_QWEN_TOKEN||'').trim();
  if(!endpoint||!token) throw Object.assign(new Error('اتصال Qwen بالكمبيوتر غير مكتمل. شغّل وسيط BUK المحلي واضبط BUK_QWEN_URL وBUK_QWEN_TOKEN على Render.'),{status:503});
  const prompt=messages.map(m=>`${m.role==='system'?'تعليمات':m.role==='assistant'?'المساعد':'المستخدم'}: ${String(m.content||'')}`).join('\\n\\n');
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message:prompt}),signal:AbortSignal.timeout(90000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||'تعذر الاتصال بـ Qwen على الكمبيوتر.'),{status:502});
  const reply=String(data.reply||data.response||'').trim();
  if(!reply)throw Object.assign(new Error('عاد Qwen برد فارغ.'),{status:502});
  return reply;
}`;
if(!s.includes(old)) throw new Error('Expected OpenAI function block was not found; refusing unsafe patch.');
s=s.replace(old,replacement);
const transStart=s.indexOf("  if(action==='transcribe'){");
const transEnd=s.indexOf("  if(action==='speak')",transStart);
if(transStart<0||transEnd<0) throw new Error('Transcription block not found.');
s=s.slice(0,transStart)+`  if(action==='transcribe'){
    return res.status(501).json({error:'التفريغ الصوتي عبر الخادم غير مفعّل لتجنب خدمات API المدفوعة. استخدم ميكروفون الجهاز/التعرف الصوتي المحلي.'});
  }
`+s.slice(transEnd);
fs.writeFileSync(file,s);
console.log('BUK backend switched from OpenAI chat/translation to local Qwen proxy; cloud transcription API disabled.');
