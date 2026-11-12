require('dotenv').config();
const express = require('express');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));
app.use(express.static('public'));

const dry = process.env.MAIL_DRY_RUN === '1';
const allowed = (process.env.ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const hits = new Map(); // per-IP limit: 10 emails per hour
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= 10) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list); return false;
}
const clean = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

app.get('/healthz', (_req, res) => res.send('ok'));

app.post('/api/send', async (req, res) => {
  try {
    if (limited(req.ip)) return res.status(429).json({ error: 'Too many emails sent. Try again later.' });
    const to = clean(req.body.to, 254).toLowerCase();
    const name = clean(req.body.name, 80) || 'Designer';
    const role = clean(req.body.role, 80);
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) return res.status(400).json({ error: 'Invalid email address.' });
    if (allowed.length && !allowed.includes(to.split('@')[1])) return res.status(403).json({ error: 'This email domain is not allowed.' });
    const b64 = String(req.body.pdf || '');
    const pdf = Buffer.from(b64, 'base64');
    if (pdf.length < 100 || pdf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Invalid or oversized PDF.' });
    if (pdf.subarray(0, 4).toString() !== '%PDF') return res.status(400).json({ error: 'Attachment is not a PDF.' });

    const payload = {
      from: process.env.MAIL_FROM || 'Design Team <onboarding@resend.dev>',
      to: [to],
      subject: `Work report - ${name}`,
      text: `Hi ${name},\n\nYour work report is attached as a PDF.\n\nRegards`,
      html: `<p>Hi ${esc(name)},</p><p>Your work report${role ? ' (' + esc(role) + ')' : ''} is attached as a PDF.</p><p>Regards</p>`,
      attachments: [{ filename: clean(req.body.filename, 100).replace(/[^\w.\-]+/g, '_') || 'work-report.pdf', content: b64 }]
    };
    if (dry) { console.log('DRY RUN to:', payload.to, 'subject:', payload.subject, 'pdf bytes:', pdf.length); return res.json({ ok: true, dryRun: true }); }
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Server is missing RESEND_API_KEY.' });

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      console.error('Resend error', r.status, JSON.stringify(body));
      const msg = r.status >= 400 && r.status < 500 && body.message ? 'Email provider says: ' + String(body.message).slice(0, 200) : 'Email could not be sent.';
      return res.status(502).json({ error: msg });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Send failed:', e.message);
    res.status(500).json({ error: 'Email could not be sent. Check the server settings.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Running on port ' + port));
