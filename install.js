import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const CONFIG_DIR = path.join(process.env.HOME || '', '.config', 'opencode');
const OMO_CONFIG_PATH = path.join(CONFIG_DIR, 'oh-my-opencode-slim.json');
const OPENCODE_CONFIG_PATH = path.join(CONFIG_DIR, 'opencode.json');
const GLOBAL_SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const GLOBAL_AGENTS_DIR = path.join(CONFIG_DIR, 'agents');
const PLUGIN_DIR = path.join(PROJECT_DIR, 'plugin');
const TASTE_SKILL_NAME = 'design-taste-frontend';
const TASTE_SKILL_SOURCE = 'https://github.com/leonxlnx/taste-skill';
const TASTE_SKILL_COMMIT = 'd1a2bb41d927083ac7118f60cfc9cdf711810ea0';
const TASTE_SKILL_PATH = path.join(PROJECT_DIR, 'skills', 'taste-skill', 'SKILL.md');
const TASTE_MANIFEST_PATH = path.join(PROJECT_DIR, 'vendor', 'UPSTREAM.json');

const args = process.argv.slice(2);
const isUninstall = args.includes('--uninstall');
const isDryRun = args.includes('--dry-run');
const withLinters = args.includes('--with-linters');

console.log('====================================================');
console.log(isUninstall ? '         Sylli Uninstallation Routine              ' : '         Sylli Installation Routine                ');
console.log('====================================================');

if (isDryRun) {
  console.log('[DRY-RUN MODE ACTIVATED: No changes will be written to disk]');
}

// 1. Role-bound skill mappings per DESIGN.md
const ROLE_SKILLS_ADD = {
  designer: [
    'mengto-ui', 'mengto-web', 'design-system', 'animate', 'animation-vocabulary',
    'find-animation-opportunities', 'improve-animations', 'antislop-ui', 'antislop-human',
    'antislop-layoutmobile', 'antislop-copywriting', 'anti-slop-css', 'anti-slop-html',
    'modern-web-guidance', 'design-taste-frontend'
  ],
  fixer: [
    'error-handling', 'backend-patterns', 'frontend-patterns', 'database-migrations',
    'postgres-patterns', 'redis-patterns', 'deployment-patterns', 'antislop-code',
    'antislop-human', 'anti-slop-css', 'anti-slop-html', 'modern-web-guidance'
  ],
  oracle: [
    'systematic-debugging', 'review-animations', 'thermos-quality', 'antislop', 'antislop-code',
    'design-taste-frontend'
  ],
  orchestrator: [
    'writing-plans', 'test-driven-development', 'antislop-copywriting', 'context-hygiene'
  ]
};

const SYLLI_AGENT_DEF = {
  model: 'omniroute/auto/best-reasoning',
  variant: 'high',
  description: 'Architect and EGM Kickoff coordinator for project requirements, DESIGN.md specs, and Goldfish reviews.',
  prompt: path.join(PROJECT_DIR, 'agents', 'sylli.md'),
  skills: ['brainstorming', 'writing-plans', 'context-hygiene']
};

// 2. Automatic project memory storage engine (DESIGN.md Delta 0.3.0, §4).
// Registered as its own OpenCode plugin; Sylli only shares its logfmt format.
const MEMORY_PLUGIN = '@knikolov/opencode-plugin-simple-memory';
const MEMORY_PLUGIN_OPTIONS = {
  autoLoad: true,
  autoSave: true,
  autoSaveScope: 'project',
  autoHookTimeoutMs: 100,
  contextLimit: 5,
  contextMaxChars: 1200
};

function pluginEntryMatches(entry, name) {
  if (typeof entry === 'string') return entry.includes(name);
  if (entry && typeof entry === 'object') {
    return String(entry.package || entry.name || entry.plugin || '').includes(name);
  }
  return false;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    return null;
  }
}

function writeJsonFile(filePath, data) {
  if (isDryRun) {
    console.log(`[DRY-RUN] Would write updated JSON to ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// OpenCode V2 uses `plugins`; `plugin` is the V1 key that V2 still accepts.
function getPluginList(config) {
  if (!config) return null;
  if (Array.isArray(config.plugins)) return config.plugins;
  if (Array.isArray(config.plugin)) return config.plugin;
  return null;
}

function ensurePluginList(config) {
  if (Array.isArray(config.plugins)) return config.plugins;
  if (Array.isArray(config.plugin)) return config.plugin;
  config.plugins = [];
  return config.plugins;
}

function isPluginRegistered(config, name) {
  const list = getPluginList(config);
  return Array.isArray(list) && list.some(p => String(p).includes(name));
}

function validateTasteSkill() {
  if (!fs.existsSync(TASTE_MANIFEST_PATH)) {
    throw new Error(`Taste Skill manifest is missing: ${path.relative(PROJECT_DIR, TASTE_MANIFEST_PATH)}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(TASTE_MANIFEST_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`Taste Skill manifest is invalid JSON: ${err.message}`);
  }
  if (manifest.commit !== TASTE_SKILL_COMMIT || manifest.skillName !== TASTE_SKILL_NAME) {
    throw new Error(`Taste Skill manifest must declare commit ${TASTE_SKILL_COMMIT} and skillName ${TASTE_SKILL_NAME}`);
  }
  if (!fs.existsSync(TASTE_SKILL_PATH)) {
    throw new Error(`Taste Skill is missing: ${path.relative(PROJECT_DIR, TASTE_SKILL_PATH)}`);
  }
  const frontmatter = fs.readFileSync(TASTE_SKILL_PATH, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const name = frontmatter?.[1].match(/^name:\s*(\S+)/m)?.[1];
  if (name !== TASTE_SKILL_NAME) {
    throw new Error(`Taste Skill frontmatter name must be ${TASTE_SKILL_NAME}; found ${name || 'missing'}`);
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    if (!isDryRun) fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      if (!isDryRun) fs.copyFileSync(srcPath, destPath);
    }
  }
}

// --- EXECUTION ---

if (!isUninstall) {
  console.log(`[Taste Skill] Source: ${TASTE_SKILL_SOURCE} @ ${TASTE_SKILL_COMMIT}`);
  console.log('[Taste Skill] Runtime requirements: Node.js >=22 and Chrome/Edge/Chromium (optional; required by browser checks).');
  try {
    validateTasteSkill();
    console.log(`  - OK: ${TASTE_SKILL_NAME} is vendored with the expected frontmatter.`);
  } catch (err) {
    console.error(`  - ERROR: ${err.message}`);
    process.exit(1);
  }

  // Step 0: Verify upstream dependencies (omo-slim must be installed first)
  console.log('[0/6] Checking upstream dependencies (oh-my-opencode-slim)...');
  const ocConfig = readJsonFile(OPENCODE_CONFIG_PATH);
  if (isPluginRegistered(ocConfig, 'oh-my-opencode-slim')) {
    console.log('  - OK: oh-my-opencode-slim is installed and registered as an OpenCode plugin.');
  } else {
    console.log('  - MISSING: oh-my-opencode-slim is not registered in opencode.json.');
    console.log('    Sylli depends on it (council agents, presets, skills_add grants).');
    if (!isDryRun) {
      try {
        ensurePluginList(ocConfig).push('oh-my-opencode-slim');
        writeJsonFile(OPENCODE_CONFIG_PATH, ocConfig);
        console.log('    -> Added "oh-my-opencode-slim" to the plugin list automatically.');
      } catch {
        console.log('    -> Could not add it automatically. Install it manually and re-run: ');
        console.log('       OpenCode -> /plugin install oh-my-opencode-slim');
        process.exit(1);
      }
    }
  }
  const omoInstalled = fs.existsSync(OMO_CONFIG_PATH);
  if (omoInstalled) {
    console.log(`  - OK: omo-slim config found at ${OMO_CONFIG_PATH}`);
  } else {
    console.log('  - NOTE: omo-slim config not found yet; it will be created on first OpenCode run after plugin registration.');
  }

  // Step 1: Ensure Plugin Dependencies are installed
  console.log('[1/6] Checking plugin dependencies (node_modules)...');
  const pluginNodeModules = path.join(PLUGIN_DIR, 'node_modules');
  if (!fs.existsSync(pluginNodeModules)) {
    console.log('  - Installing plugin dependencies in plugin/ ...');
    if (!isDryRun) {
      try {
        execSync('npm install --production', { cwd: PLUGIN_DIR, stdio: 'inherit' });
      } catch (err) {
        console.warn(`  - Warning: npm install failed: ${err.message}`);
      }
    }
  } else {
    console.log('  - Plugin dependencies are already installed.');
  }

  // Optional: Install global linters for instant anti-slop gate execution
  if (withLinters) {
    console.log('[+] Installing anti-slop linter tools (oxlint, stylelint, html-validate)...');
    if (!isDryRun) {
      try {
        const pkgManager = fs.existsSync(path.join(process.env.HOME || '', '.bun', 'bin', 'bun')) ? 'bun add -g' : 'npm install -g';
        console.log(`  - Running: ${pkgManager} oxlint stylelint html-validate`);
        execSync(`${pkgManager} oxlint stylelint html-validate`, { stdio: 'inherit' });
      } catch (err) {
        console.warn(`  - Warning: Linters install failed (${err.message}). They will remain available via npx.`);
      }
    }
  }

  // Step 2: Check for collisions in global skills directory
  console.log('[2/6] Checking for skill namespace collisions...');
  if (fs.existsSync(GLOBAL_SKILLS_DIR)) {
    const localSkills = fs.readdirSync(path.join(PROJECT_DIR, 'skills'));
    const existingSkills = fs.readdirSync(GLOBAL_SKILLS_DIR);
    const collisions = localSkills.filter(s => existingSkills.includes(s));
    if (collisions.length > 0) {
      console.log(`  - Note: ${collisions.length} skills already exist in ${GLOBAL_SKILLS_DIR} (will be updated cleanly)`);
    } else {
      console.log('  - No collisions detected.');
    }
  }

  // Step 3: Copy skills and agent prompts
  console.log('[3/6] Deploying skills and agent definitions to OpenCode...');
  if (!isDryRun) {
    fs.mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
    fs.mkdirSync(GLOBAL_AGENTS_DIR, { recursive: true });
  }
  
  // Copy skills
  const skillsSrc = path.join(PROJECT_DIR, 'skills');
  const skills = fs.readdirSync(skillsSrc);
  for (const skill of skills) {
    const src = path.join(skillsSrc, skill);
    const dest = path.join(GLOBAL_SKILLS_DIR, skill);
    if (fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }
  console.log(`  - Deployed ${skills.length} skills to ${GLOBAL_SKILLS_DIR}`);

  // Copy agent prompts
  const agentsSrc = path.join(PROJECT_DIR, 'agents');
  const agentFiles = fs.readdirSync(agentsSrc);
  for (const f of agentFiles) {
    const src = path.join(agentsSrc, f);
    const dest = path.join(GLOBAL_AGENTS_DIR, f);
    if (!isDryRun) fs.copyFileSync(src, dest);
  }
  console.log(`  - Deployed ${agentFiles.length} agent personas to ${GLOBAL_AGENTS_DIR}`);

  // Step 4: Update oh-my-opencode-slim.json additively
  console.log('[4/6] Registering sylli and role-bound skills in oh-my-opencode-slim...');
  const omoConfig = readJsonFile(OMO_CONFIG_PATH);
  if (omoConfig) {
    omoConfig.agents = omoConfig.agents || {};
    omoConfig.agents.sylli = SYLLI_AGENT_DEF;

    const activePreset = omoConfig.preset || 'omniroute';
    if (omoConfig.presets && omoConfig.presets[activePreset]) {
      const preset = omoConfig.presets[activePreset];
      for (const [role, newSkills] of Object.entries(ROLE_SKILLS_ADD)) {
        if (preset[role]) {
          const currentSkills = preset[role].skills || [];
          if (!currentSkills.includes('*')) {
            const combined = Array.from(new Set([...currentSkills, ...newSkills]));
            preset[role].skills = combined;
          }
        }
      }
    }

    writeJsonFile(OMO_CONFIG_PATH, omoConfig);
    console.log(`  - Updated ${OMO_CONFIG_PATH} (Preset: ${activePreset})`);
  } else {
    console.warn(`  - Warning: Could not find ${OMO_CONFIG_PATH}`);
  }

  // Step 5: Register Sylli plugin in opencode.json
  console.log('[5/6] Registering Sylli Security & Rule Plugin in opencode.json...');
  const opencodeConfig = readJsonFile(OPENCODE_CONFIG_PATH);
  if (opencodeConfig) {
    const pluginList = ensurePluginList(opencodeConfig);
    const pluginEntry = path.join(PROJECT_DIR, 'plugin');
    if (!pluginList.includes(pluginEntry)) {
      pluginList.push(pluginEntry);
      writeJsonFile(OPENCODE_CONFIG_PATH, opencodeConfig);
      console.log(`  - Added plugin '${pluginEntry}' to opencode.json`);
    } else {
      console.log('  - Plugin already registered in opencode.json');
    }
  }

  // Step 6: Register the automatic project memory storage engine
  console.log('[6/6] Registering project memory plugin (@knikolov/opencode-plugin-simple-memory)...');
  const memoryConfig = readJsonFile(OPENCODE_CONFIG_PATH);
  if (memoryConfig) {
    const memoryList = ensurePluginList(memoryConfig);
    if (memoryList.some(p => pluginEntryMatches(p, MEMORY_PLUGIN))) {
      console.log('  - Memory plugin already registered in opencode.json');
    } else {
      memoryList.push({ package: MEMORY_PLUGIN, options: MEMORY_PLUGIN_OPTIONS });
      writeJsonFile(OPENCODE_CONFIG_PATH, memoryConfig);
      console.log(`  - Added memory plugin '${MEMORY_PLUGIN}' to opencode.json`);
    }
    console.log(`  - Automatic project memory ENABLED: typed records in .opencode/memory/ (autoLoad + autoSave, scope=project); Sylli hygiene compacts at 1 MB and age-purges context/blocker/learning after 90 days.`);
  }

  console.log('\n====================================================');
  console.log('Installation Complete! You can now use @sylli in OpenCode.');
  console.log('====================================================');

} else {
  // UNINSTALL ROUTINE
  console.log('[1/4] Removing Sylli agent and role-bound skills from oh-my-opencode-slim...');
  const omoConfig = readJsonFile(OMO_CONFIG_PATH);
  if (omoConfig) {
    if (omoConfig.agents && omoConfig.agents.sylli) {
      delete omoConfig.agents.sylli;
    }
    const activePreset = omoConfig.preset || 'omniroute';
    if (omoConfig.presets && omoConfig.presets[activePreset]) {
      const preset = omoConfig.presets[activePreset];
      for (const [role, addedSkills] of Object.entries(ROLE_SKILLS_ADD)) {
        if (preset[role] && Array.isArray(preset[role].skills)) {
          preset[role].skills = preset[role].skills.filter(s => !addedSkills.includes(s));
        }
      }
    }
    writeJsonFile(OMO_CONFIG_PATH, omoConfig);
    console.log('  - Cleaned oh-my-opencode-slim configuration');
  }

  console.log('[2/4] Removing Sylli plugin from opencode.json...');
  const opencodeConfig = readJsonFile(OPENCODE_CONFIG_PATH);
  if (opencodeConfig) {
    const pluginEntry = path.join(PROJECT_DIR, 'plugin');
    let removed = false;
    for (const key of ['plugins', 'plugin']) {
      if (Array.isArray(opencodeConfig[key])) {
        const filtered = opencodeConfig[key].filter(p => p !== pluginEntry);
        if (filtered.length !== opencodeConfig[key].length) removed = true;
        opencodeConfig[key] = filtered;
      }
    }
    if (removed) {
      writeJsonFile(OPENCODE_CONFIG_PATH, opencodeConfig);
      console.log('  - Cleaned opencode.json plugin entry');
    }
  }

  console.log('[3/4] Removing project memory plugin registration from opencode.json...');
  const memoryUninstallConfig = readJsonFile(OPENCODE_CONFIG_PATH);
  if (memoryUninstallConfig) {
    let memoryRemoved = false;
    for (const key of ['plugins', 'plugin']) {
      if (Array.isArray(memoryUninstallConfig[key])) {
        const filtered = memoryUninstallConfig[key].filter(p => !pluginEntryMatches(p, MEMORY_PLUGIN));
        if (filtered.length !== memoryUninstallConfig[key].length) memoryRemoved = true;
        memoryUninstallConfig[key] = filtered;
      }
    }
    if (memoryRemoved) {
      writeJsonFile(OPENCODE_CONFIG_PATH, memoryUninstallConfig);
      console.log('  - Removed project memory plugin registration');
    } else {
      console.log('  - Project memory plugin was not registered');
    }
  }

  console.log('[4/4] Sylli agent and bindings successfully removed.');
  console.log('====================================================');
}
