const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3456;
const DATA_FILE = path.join(__dirname, 'webhooks.json');

const webhooks = [];
const sseClients = new Set();
const MAX_WEBHOOKS = 500;

try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    webhooks.push(...(data.webhooks || []));
    console.log(`Loaded ${webhooks.length} saved webhooks`);
  }
} catch (e) { console.log('No saved data (fresh start)'); }

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    webhooks: webhooks.slice(0, MAX_WEBHOOKS),
    updated: new Date().toISOString()
  }, null, 2));
}

function broadcast(event, data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch (e) { sseClients.delete(client); }
  }
}

// API routes — parse JSON, not raw
app.use('/api', express.json());
app.use(cors());

// SSE endpoint
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.post('/api/endpoints', (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  res.json({ id, url: `/hook/${id}` });
});

app.get('/api/webhooks', (req, res) => {
  const endpointId = req.query.endpoint;
  const limit = parseInt(req.query.limit) || 100;
  let result = webhooks;
  if (endpointId) result = result.filter(w => w.endpointId === endpointId);
  res.json(result.slice(0, limit));
});

app.delete('/api/webhooks', (req, res) => {
  const endpointId = req.query.endpoint;
  if (endpointId) {
    const before = webhooks.length;
    for (let i = webhooks.length - 1; i >= 0; i--) {
      if (webhooks[i].endpointId === endpointId) webhooks.splice(i, 1);
    }
    res.json({ cleared: before - webhooks.length });
  } else {
    const count = webhooks.length;
    webhooks.length = 0;
    res.json({ cleared: count });
  }
  save();
  broadcast('clear', { endpointId });
});

app.post('/api/webhooks/:id/replay', (req, res) => {
  const wh = webhooks.find(w => w.id === req.params.id);
  if (!wh) return res.status(404).json({ error: 'Not found' });
  const replay = { ...wh, id: crypto.randomBytes(6).toString('hex'), timestamp: new Date().toISOString(), replayedFrom: wh.id };
  webhooks.unshift(replay);
  broadcast('new', replay);
  res.json(replay);
});

app.get('/api/stats', (req, res) => {
  const endpoints = {};
  for (const wh of webhooks) {
    if (!endpoints[wh.endpointId]) endpoints[wh.endpointId] = { count: 0, methods: {}, lastRequest: null };
    endpoints[wh.endpointId].count++;
    endpoints[wh.endpointId].methods[wh.method] = (endpoints[wh.endpointId].methods[wh.method] || 0) + 1;
    if (!endpoints[wh.endpointId].lastRequest || wh.timestamp > endpoints[wh.endpointId].lastRequest) {
      endpoints[wh.endpointId].lastRequest = wh.timestamp;
    }
  }
  res.json({ totalWebhooks: webhooks.length, endpoints, uptime: process.uptime() });
});

// Raw body parser for webhook routes ONLY
app.use('/hook', express.raw({ type: () => true, limit: '5mb' }));

// Catch-all webhook receiver
app.all('/hook/:id', (req, res) => {
  const start = Date.now();
  const body = req.body;
  let parsedBody = null;

  if (body && body.length > 0) {
    const str = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
    try { parsedBody = JSON.parse(str); } catch (e) { parsedBody = str; }
  }

  const wh = {
    id: crypto.randomBytes(6).toString('hex'),
    endpointId: req.params.id,
    method: req.method,
    path: req.originalUrl,
    headers: req.headers,
    query: req.query,
    body: parsedBody,
    contentType: req.get('content-type') || 'unknown',
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    responseTime: null
  };

  webhooks.unshift(wh);
  if (webhooks.length > MAX_WEBHOOKS) webhooks.length = MAX_WEBHOOKS;

  if (webhooks.length % 10 === 0) save();

  wh.responseTime = Date.now() - start;
  broadcast('new', wh);

  res.status(200).json({ ok: true, received: wh.timestamp, id: wh.id });
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`\n  Webhook Debugger: http://localhost:${PORT}`);
  console.log(`  Hook URL: http://localhost:${PORT}/hook/<your-id>\n`);
});

process.on('SIGINT', () => { save(); process.exit(0); });
