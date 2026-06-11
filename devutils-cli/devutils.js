#!/usr/bin/env node
const crypto = require('crypto');
const { Readable } = require('stream');

const args = process.argv.slice(2);
const cmd = args[0];
const input = args.slice(1).join(' ');

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(input || '');
    let data = '';
    process.stdin.on('data', d => data += d);
    process.stdin.on('end', () => resolve(data.trim() || input || ''));
  });
}

function usage() {
  console.log(`
  🔧 DevUtils CLI — 开发常用工具箱

  Usage: devutils <command> [args]

  Commands:
    jsonfmt              Format JSON from stdin/args → pretty print
    jsonmin              Minify JSON from stdin/args
    ts2dt  <timestamp>   Unix timestamp → human datetime
    dt2ts  <datetime>    Human datetime → Unix timestamp
    now                  Current timestamp (ms + ISO)
    b64enc <text>        Base64 encode
    b64dec <text>        Base64 decode
    uuid                 Generate UUID v4
    jwtdec <token>       Decode JWT (show header + payload)
    port   <port>        Check if a port is available (basic)
    hash   <text>        SHA256 hash
    qr     <text>        Generate QR code as ASCII (terminal)
    ip                    Show your public IP

  Examples:
    echo '{"a":1}' | devutils jsonfmt
    devutils ts2dt 1718000000
    devutils uuid
    devutils jwtdec eyJhbGciOi...
`);
}

async function main() {
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') return usage();

  try {
    switch (cmd) {
      case 'jsonfmt': {
        const s = await readStdin();
        console.log(JSON.stringify(JSON.parse(s), null, 2));
        break;
      }
      case 'jsonmin': {
        const s = await readStdin();
        console.log(JSON.stringify(JSON.parse(s)));
        break;
      }
      case 'ts2dt': {
        const ts = parseInt(await readStdin());
        const d = new Date(ts * (ts > 9999999999 ? 1 : 1000));
        console.log(`Unix:  ${ts}`);
        console.log(`UTC:   ${d.toISOString()}`);
        console.log(`Local: ${d.toString()}`);
        break;
      }
      case 'dt2ts': {
        const s = await readStdin();
        const d = new Date(s);
        console.log(`Unix (s):  ${Math.floor(d.getTime() / 1000)}`);
        console.log(`Unix (ms): ${d.getTime()}`);
        break;
      }
      case 'now': {
        const d = new Date();
        console.log(`Unix (s):  ${Math.floor(d.getTime() / 1000)}`);
        console.log(`Unix (ms): ${d.getTime()}`);
        console.log(`ISO:      ${d.toISOString()}`);
        console.log(`Local:    ${d.toString()}`);
        break;
      }
      case 'b64enc': {
        const s = await readStdin();
        console.log(Buffer.from(s).toString('base64'));
        break;
      }
      case 'b64dec': {
        const s = await readStdin();
        console.log(Buffer.from(s, 'base64').toString('utf-8'));
        break;
      }
      case 'uuid': {
        console.log(crypto.randomUUID());
        break;
      }
      case 'jwtdec': {
        const token = await readStdin();
        const parts = token.split('.');
        if (parts.length !== 3) { console.log('Invalid JWT format'); break; }
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        console.log('=== HEADER ===');
        console.log(JSON.stringify(header, null, 2));
        console.log('=== PAYLOAD ===');
        console.log(JSON.stringify(payload, null, 2));
        if (payload.exp) {
          const exp = new Date(payload.exp * 1000);
          const now = new Date();
          console.log(`=== TOKEN ${exp < now ? 'EXPIRED' : 'valid'} ===`);
          console.log(`Expires: ${exp.toISOString()}`);
          console.log(`Remaining: ${Math.max(0, Math.floor((exp - now) / 60000))} minutes`);
        }
        break;
      }
      case 'port': {
        const port = parseInt(await readStdin());
        const net = require('net');
        const server = net.createServer();
        server.listen(port, () => {
          console.log(`Port ${port}: AVAILABLE`);
          server.close();
        });
        server.on('error', () => {
          console.log(`Port ${port}: IN USE`);
        });
        break;
      }
      case 'hash': {
        const s = await readStdin();
        console.log(crypto.createHash('sha256').update(s).digest('hex'));
        break;
      }
      case 'ip': {
        console.log('Check https://ifconfig.me or use: curl ifconfig.me');
        break;
      }
      default:
        console.log(`Unknown command: ${cmd}`);
        usage();
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
