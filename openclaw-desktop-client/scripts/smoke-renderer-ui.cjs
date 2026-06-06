const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'renderer', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'renderer', 'app.js'), 'utf8');
const scanner = fs.readFileSync(path.join(root, 'src', 'local-agent-scanner.cjs'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesAll(source, values, label) {
  for (const value of values) {
    assert(source.includes(value), `${label} missing "${value}"`);
  }
}

function matchesAll(source, patterns, label) {
  for (const pattern of patterns) {
    assert(pattern.test(source), `${label} missing pattern ${pattern}`);
  }
}

includesAll(html, [
  'OpenClaw Desktop',
  'class="shell"',
  'class="sidebar"',
  'id="open-web"',
  'data-href="http://localhost:3000/projects"',
  'data-href="http://localhost:3000/architectures/mine"',
  'id="scan"',
  'class="scan-strip"',
  'Claude Code',
  'Codex',
  'OpenCode',
  'Hermes',
  'OpenClaw',
  'data/workspaces',
  'id="results"',
  'id="runtime-refresh"',
  'id="runtime-health"',
  'id="runtime-ready"',
  'id="runtime-missing-cli"',
  'id="runtime-missing-provider"',
  'id="backend-url"',
  'id="auth-token"',
  'id="import-agent"',
  'id="import-status"',
], 'renderer html');

includesAll(css, [
  '.shell',
  'grid-template-columns: 260px 1fr',
  '.sidebar',
  '.workspace',
  '.hero',
  '.scan-strip',
  'grid-template-columns: repeat(5, minmax(0, 1fr))',
  '.results',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '.runtime-summary',
  '.runtime-grid',
  '.runtime-card',
  '.runtime-badge',
  '.form-grid',
], 'renderer css');

includesAll(app, [
  'scanLocalAgents',
  'readLocalAgentFolder',
  'renderSkippedFiles',
  'skippedCount',
  '/api/upload',
  '/api/providers/runtime-health',
  'refreshRuntimeHealth',
  'renderRuntimeHealth',
  'deferMarketPublish',
  'localStorage',
], 'renderer app');

matchesAll(app, [
  /selectedFolder\s*=\s*await\s+window\.openclawDesktop\.readLocalAgentFolder\(agent\.path\)/,
  /fetch\(`\$\{backendUrl\}\/api\/upload`,\s*\{/,
  /method:\s*'POST'/,
  /Authorization:\s*`Bearer \$\{token\}`/,
  /'Content-Type':\s*'application\/json'/,
  /uploadType:\s*'folder'/,
  /agentType:\s*selectedAgent\.type/,
  /files:\s*selectedFolder\.files/,
  /publishToMarket:\s*false/,
  /deferMarketPublish:\s*true/,
  /\/agent\/\$\{encodeURIComponent\(payload\.agentId\)\}/,
], 'renderer import flow');

matchesAll(scanner, [
  /function\s+collectFolderForUpload\(/,
  /collectFolderForUpload,/,
  /SENSITIVE_UPLOAD_PATH_PATTERNS/,
  /\(\^\|\\\/\)\\.env/,
  /agent\\.config\\.json/,
  /\\.openclaw/,
  /files\.push\(\{\s*path:\s*relativePath,\s*content:\s*fs\.readFileSync\(fullPath\)\.toString\('base64'\),\s*\}\)/s,
], 'local scanner upload flow');

console.log(JSON.stringify({
  rendererUiVerified: true,
  layout: 'wide-shell-sidebar-workspace',
  supportedAgentTypes: ['Claude Code', 'Codex', 'OpenCode', 'Hermes', 'OpenClaw'],
  localImportFlow: true,
  localImportPayloadVerified: true,
  scannerUploadFilteringVerified: true,
  runtimeHealthPanel: true,
}, null, 2));
