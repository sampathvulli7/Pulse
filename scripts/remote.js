const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');

const ROOT_DIR = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT_DIR, '.bin');
const PORT = process.env.PORT || 3001;

function getCloudflaredPath() {
  // 1. Check node_modules/.bin
  const nmBin = path.join(ROOT_DIR, 'node_modules/.bin/cloudflared');
  if (fs.existsSync(nmBin)) {
    return nmBin;
  }

  // 2. Check local .bin
  const localBin = path.join(BIN_DIR, 'cloudflared');
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  // 3. Check system PATH
  try {
    const which = execSync('which cloudflared', { stdio: 'pipe' }).toString().trim();
    if (which && fs.existsSync(which)) return which;
  } catch (e) {}

  return null;
}

function downloadCloudflared() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  const platform = os.platform();
  const arch = os.arch();
  console.log(`[Pulse Remote] Fetching cloudflared for ${platform}-${arch}...`);

  let downloadUrl = '';
  if (platform === 'darwin') {
    downloadUrl = arch === 'arm64'
      ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz'
      : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz';
    
    execSync(`curl -L "${downloadUrl}" -o "${BIN_DIR}/cf.tgz" && tar -xzf "${BIN_DIR}/cf.tgz" -C "${BIN_DIR}" && rm -f "${BIN_DIR}/cf.tgz"`, {
      stdio: 'inherit',
    });
  } else if (platform === 'linux') {
    downloadUrl = arch === 'arm64'
      ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64'
      : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
    
    execSync(`curl -L "${downloadUrl}" -o "${BIN_DIR}/cloudflared" && chmod +x "${BIN_DIR}/cloudflared"`, {
      stdio: 'inherit',
    });
  }

  const binaryPath = path.join(BIN_DIR, 'cloudflared');
  if (fs.existsSync(binaryPath)) {
    fs.chmodSync(binaryPath, 0o755);
    return binaryPath;
  }

  throw new Error('Could not download cloudflared binary.');
}

async function isServerRunning(port) {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('   PULSE MUSIC WORKSTATION — SECURE REMOTE LAUNCHER   ');
  console.log('======================================================\n');

  // 1. Check or download cloudflared
  let cloudflared = getCloudflaredPath();
  if (!cloudflared) {
    try {
      cloudflared = downloadCloudflared();
    } catch (err) {
      console.error('[Error] Could not setup cloudflared:', err.message);
      process.exit(1);
    }
  }

  // 2. Ensure Pulse server is running
  const running = await isServerRunning(PORT);
  let serverProcess = null;

  if (!running) {
    console.log(`[Pulse Remote] Starting Pulse backend on port ${PORT}...`);
    // Ensure production build exists
    if (!fs.existsSync(path.join(ROOT_DIR, 'backend/dist/server.js'))) {
      console.log('[Pulse Remote] Building backend and frontend for production...');
      execSync('npm run build --prefix frontend && npm run build --prefix backend', {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });
    }

    serverProcess = spawn('node', ['backend/dist/server.js'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(d.toString()));
    serverProcess.stderr.on('data', (d) => process.stderr.write(d.toString()));

    // Wait for server to be responsive
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isServerRunning(PORT)) break;
    }
  } else {
    console.log(`[Pulse Remote] Detected active Pulse instance on port ${PORT}`);
  }

  // 3. Launch Cloudflare Tunnel
  console.log('[Pulse Remote] Establishing secure encrypted tunnel...');
  const tunnel = spawn(cloudflared, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let urlFound = false;

  const handleTunnelOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !urlFound) {
      urlFound = true;
      const tunnelUrl = match[0];

      console.log('\n======================================================');
      console.log('      PULSE IS READY ON YOUR PHONE ANYWHERE!         ');
      console.log('======================================================\n');
      console.log(`  Secure Global URL: \x1b[32m\x1b[1m${tunnelUrl}\x1b[0m\n`);
      console.log('  SCAN THIS QR CODE WITH YOUR PHONE CAMERA:\n');

      qrcode.generate(tunnelUrl, { small: true });

      console.log('\n  Mobile PWA Install Instructions:');
      console.log('  1. Scan the QR code above with your phone camera.');
      console.log('  2. In Safari (iOS): Tap "Share" -> "Add to Home Screen".');
      console.log('  3. In Chrome (Android): Tap menu (3 dots) -> "Install app".');
      console.log('  4. Pulse now runs as a standalone app on your phone with');
      console.log('     offline cache and real-time sync with your laptop!\n');
      console.log('======================================================\n');
      console.log('Press Ctrl+C to stop remote sharing.\n');
    }
  };

  tunnel.stdout.on('data', handleTunnelOutput);
  tunnel.stderr.on('data', handleTunnelOutput);

  tunnel.on('close', (code) => {
    if (!urlFound) {
      console.error('[Pulse Remote] Tunnel closed with code:', code);
    }
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n[Pulse Remote] Shutting down remote tunnel...');
    tunnel.kill();
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  });
}

main().catch(console.error);
