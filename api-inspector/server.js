const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4567;
const DATA_FILE = path.join(__dirname, 'requests.json');

const requests = [];
const sseClients = new Set();
const MAX = 1000;

try {
  if (fs.existsSync(DATA_FILE)) {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    requests.push(...(d.requests || []));
  }
} catch (e) {}

function save() { fs.writeFileSync(DATA_FILE, JSON.stringify({requests: requests.slice(0, MAX), updated: new Date().toISOString()})); }
function broadcast(e, d) {
  const m = `data: ${JSON.stringify(d)}\n\n`;
  for (const c of sseClients) try { c.write(m); } catch { sseClients.delete(c); }
}

// API routes (JSON)
app.use('/api', express.json());

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
  res.write('\n'); sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.post('/api/endpoints', (req, res) => {
  const id = crypto.randomBytes(6).toString('hex');
  res.json({id, urls: {any: `/catch/${id}`, get: `/catch/${id}/get`, post: `/catch/${id}/post`}});
});

app.get('/api/requests', (req, res) => {
  const ep = req.query.endpoint, limit = parseInt(req.query.limit) || 200;
  const r = ep ? requests.filter(w => w.endpointId === ep) : requests;
  res.json(r.slice(0, limit));
});

app.delete('/api/requests', (req, res) => {
  const ep = req.query.endpoint;
  if (ep) {
    const b = requests.length;
    for (let i = requests.length-1; i >= 0; i--) if (requests[i].endpointId === ep) requests.splice(i, 1);
    res.json({cleared: b - requests.length});
  } else { const c = requests.length; requests.length = 0; res.json({cleared: c}); }
  save(); broadcast('clear', {ep});
});

app.get('/api/stats', (req, res) => {
  const eps = {};
  for (const w of requests) {
    if (!eps[w.endpointId]) eps[w.endpointId] = {count:0, methods:{}, last:null};
    eps[w.endpointId].count++;
    eps[w.endpointId].methods[w.method] = (eps[w.endpointId].methods[w.method] || 0) + 1;
    if (!eps[w.endpointId].last || w.timestamp > eps[w.endpointId].last) eps[w.endpointId].last = w.timestamp;
  }
  res.json({total: requests.length, endpoints: eps, uptime: process.uptime()});
});

// Replay
app.post('/api/requests/:id/replay', (req, res) => {
  const w = requests.find(r => r.id === req.params.id);
  if (!w) return res.status(404).json({error:'Not found'});
  const replay = {...w, id: crypto.randomBytes(6).toString('hex'), timestamp: new Date().toISOString(), replayedFrom: w.id};
  requests.unshift(replay); broadcast('new', replay);
  res.json(replay);
});

// Simulate response (useful!)
app.post('/api/requests/:id/respond', (req, res) => {
  const w = requests.find(r => r.id === req.params.id);
  if (!w) return res.status(404).json({error:'Not found'});
  const status = parseInt(req.body.status) || 200;
  const body = req.body.body || {ok:true};
  const delay = parseInt(req.body.delay) || 0;
  setTimeout(() => res.status(status).json(body), delay);
});

// Raw body for webhook routes
app.use('/catch', express.raw({type: () => true, limit: '10mb'}));

app.all('/catch/:id/*', (req, res) => {
  const start = Date.now();
  const body = req.body;
  let parsed = null;
  if (body && body.length > 0) {
    const s = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
    try { parsed = JSON.parse(s); } catch { parsed = s; }
  }

  const wh = {
    id: crypto.randomBytes(6).toString('hex'),
    endpointId: req.params.id,
    method: req.method,
    path: req.originalUrl,
    headers: req.headers,
    query: req.query,
    body: parsed,
    contentType: req.get('content-type') || 'unknown',
    ip: req.ip || req.socket.remoteAddress,
    timestamp: new Date().toISOString(),
    responseTime: null
  };

  requests.unshift(wh);
  if (requests.length > MAX) requests.length = MAX;
  if (requests.length % 10 === 0) save();
  wh.responseTime = Date.now() - start;
  broadcast('new', wh);

  // Default response — can be customized
  const delay = parseInt(req.query._delay) || 0;
  const status = parseInt(req.query._status) || 200;
  const resp = req.query._response ? JSON.parse(req.query._response) : {ok: true, received: wh.id};
  setTimeout(() => res.status(status).json(resp), delay);
});

app.all('/catch/:id', (req, res) => {
  const start = Date.now();
  const body = req.body;
  let parsed = null;
  if (body && body.length > 0) {
    const s = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
    try { parsed = JSON.parse(s); } catch { parsed = s; }
  }

  const wh = {
    id: crypto.randomBytes(6).toString('hex'),
    endpointId: req.params.id,
    method: req.method,
    path: req.originalUrl,
    headers: req.headers,
    query: req.query,
    body: parsed,
    contentType: req.get('content-type') || 'unknown',
    ip: req.ip || req.socket.remoteAddress,
    timestamp: new Date().toISOString(),
    responseTime: null
  };

  requests.unshift(wh);
  if (requests.length > MAX) requests.length = MAX;
  if (requests.length % 10 === 0) save();
  wh.responseTime = Date.now() - start;
  broadcast('new', wh);

  const delay = parseInt(req.query._delay) || 0;
  const status = parseInt(req.query._status) || 200;
  const resp = req.query._response ? JSON.parse(req.query._response) : {ok: true, received: wh.id};
  setTimeout(() => res.status(status).json(resp), delay);
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const server = app.listen(PORT, () => {
  console.log(`\n  API Inspector: http://localhost:${PORT}`);
  console.log(`  Catch URL: http://localhost:${PORT}/catch/<id>\n`);
});

process.on('SIGINT', () => { save(); process.exit(0); });
