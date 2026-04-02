// Psych-Sentinel v1.0 Core Engine (SOAR Upgrade)
import { initDb, saveLog, getHistoricalMetrics } from './db.js';
import { generateRemediation } from './ai.js';

// State
let isDemoMode = true;
let lambda = 0.1; 
let uptimePercent = 100.0;
let successCount = 0;
let errorCount = 0;
let systemPressure = 0;
let isLockdown = false;

let threats = [];
let chartInstance = null;

// DOM Elements
const cliInput = document.getElementById('cli-input');
const cliLog = document.getElementById('cli-log');
const threatBoard = document.getElementById('threat-board');
const uptimeText = document.getElementById('uptime-text');
const uptimeRing = document.getElementById('uptime-ring');
const uptimeGlow = document.getElementById('uptime-glow');
const systemStatus = document.getElementById('system-status');

const pressureText = document.getElementById('pressure-text');
const pressureFill = document.getElementById('pressure-fill');
const coolingOverlay = document.getElementById('cooling-overlay');
const coolingTimer = document.getElementById('cooling-timer');
const btnDebugLockout = document.getElementById('btn-debug-lockout');

const btnDemoMode = document.getElementById('btn-demo-mode');
const btnRealMode = document.getElementById('btn-real-mode');
const btnRecalibrate = document.getElementById('btn-recalibrate');

const sopModal = document.getElementById('sop-modal');
const sopCard = document.getElementById('sop-card');
const sopContent = document.getElementById('sop-content');
const sopTtpName = document.getElementById('sop-ttp-name');
const sopRiskBadge = document.getElementById('sop-risk-badge');
const btnDismissSop = document.getElementById('btn-dismiss-sop');

// --- AI Pipeline & SOAR Logic ---

async function processSOAR(text) {
  if (isLockdown) return;

  // 1. Thinking Animation
  systemStatus.innerText = "ANALYZING_PAYLOAD...";
  systemStatus.className = "text-yellow-500 animate-pulse";
  
  const thinkingStates = [
    "[DE-OBFUSCATING_DISTORTION]...",
    "[MAPPING_COGNITIVE_TTP]...",
    "[CALCULATING_RISK_VECTOR]..."
  ];
  
  for (const state of thinkingStates) {
    logToCLI(state, "sys-info");
    await new Promise(r => setTimeout(r, 600));
  }

  try {
    const result = await generateRemediation(text);
    
    // 2. Process Result
    systemStatus.innerText = "THREAT_IDENTIFIED";
    systemStatus.className = "text-ops-threat";

    // Update Metrics
    errorCount++;
    updateChart();

    // Spawn Physical Threat
    spawnThreat(text, result);

    // Update Pressure: Pressure = sum (Risk * severity_weight)
    // We treat each threat as weight 5 for pressure calculation
    const pressureIncrease = result.riskScore * 5;
    updatePressure(pressureIncrease);

    // Show AI SOP Modal
    triggerSOP(result);

    // Persist to Turso
    await saveLog(text, result.ttp, 5, result.riskScore, systemPressure, 'threat');
    logToCLI(`SOAR Artifact generated. TTP: ${result.ttp}. Risk: ${result.riskScore}`, "sys-db");

  } catch (err) {
    logToCLI("Reasoning Engine Timeout. Reverting to local heuristic.", "sys-crit");
    systemStatus.innerText = "FALLBACK_MODE";
  }
}

function updatePressure(val) {
  systemPressure += val;
  if (systemPressure > 100) systemPressure = 100;
  
  pressureText.innerText = `${Math.round(systemPressure)}%`;
  pressureFill.style.width = `${systemPressure}%`;

  if (systemPressure > 80) {
    pressureFill.classList.replace('bg-ops-accent', 'bg-ops-threat');
    triggerLockdown();
  } else if (systemPressure > 50) {
    pressureFill.classList.replace('bg-ops-accent', 'bg-yellow-500');
  }
}

function triggerLockdown() {
  if (isLockdown) return;
  isLockdown = true;
  coolingOverlay.classList.remove('hidden');
  logToCLI("CRITICAL: SYSTEM PRESSURE EXCEEDED 80%. ENTERING COOLING PERIOD.", "sys-crit");
  
  let secondsLeft = 300; // 5 minutes
  const timer = setInterval(() => {
    secondsLeft--;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    coolingTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    if (secondsLeft <= 0) {
      clearInterval(timer);
      releaseLockdown();
    }
  }, 1000);
}

function releaseLockdown() {
  isLockdown = false;
  systemPressure = 0;
  updatePressure(0);
  coolingOverlay.classList.add('hidden');
  pressureFill.classList.replace('bg-ops-threat', 'bg-ops-accent');
  logToCLI("Cooling Period Complete. System logic gates restored.", "sys-info");
}

btnDebugLockout.addEventListener('click', releaseLockdown);

// --- UI Logic ---

function triggerSOP(result) {
  sopTtpName.innerText = `TTP: ${result.ttp}`;
  sopRiskBadge.innerText = `RISK: ${result.riskScore}`;
  sopContent.innerHTML = result.remediation.map(step => `<p class="flex gap-2"><span class="text-ops-sop">→</span> ${step}</p>`).join("");
  
  sopModal.classList.remove('hidden');
  setTimeout(() => {
    sopCard.classList.remove('opacity-0', 'scale-95', 'translate-y-10');
  }, 10);
}

btnDismissSop.addEventListener('click', () => {
  sopCard.classList.add('opacity-0', 'scale-95', 'translate-y-10');
  setTimeout(() => {
    sopModal.classList.add('hidden');
    systemStatus.innerText = "SYSTEM_IDLE";
    systemStatus.className = "text-ops-accent";
  }, 500);
});

function spawnThreat(text, result) {
  const id = 'threat-' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'decay-card absolute w-[90%] left-[5%] glass-panel p-4 border border-ops-threat/30 neon-red-glow flex flex-col gap-2 z-10';
  el.innerHTML = `
    <div class="flex justify-between items-center font-mono text-xs text-ops-threat uppercase">
      <span class="font-bold flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-ops-threat animate-ping"></div>
        ${result.ttp}
      </span>
      <span id="sev-${id}">RISK: ${result.riskScore}</span>
    </div>
    <div class="text-sm font-sans text-gray-300 italic opacity-80">"${text}"</div>
  `;
  threatBoard.appendChild(el);

  threats.push({
    id,
    el,
    initialSeverity: result.riskScore,
    currentSeverity: result.riskScore,
    timestamp: Date.now()
  });

  recalculateUptime();
}

function physicsLoop() {
  const now = Date.now();
  threats.forEach((t, index) => {
    const timeElapsed = (now - t.timestamp) / 1000;
    t.currentSeverity = t.initialSeverity * Math.exp(-lambda * timeElapsed);
    
    // UI Update
    const verticalPos = 100 - (t.currentSeverity / t.initialSeverity * 100); 
    const opacityPos = Math.max(0, t.currentSeverity / t.initialSeverity);
    const scalePos = 0.8 + (0.2 * opacityPos);
    
    t.el.style.transform = `translateY(${verticalPos * 3}px) scale(${scalePos})`;
    t.el.style.opacity = opacityPos;
    
    if (t.currentSeverity < 0.1) {
      if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      threats.splice(index, 1);
    }
  });

  recalculateUptime();
  requestAnimationFrame(physicsLoop);
}

function recalculateUptime() {
  let penalty = 0;
  threats.forEach(t => { penalty += t.currentSeverity * 2; });
  let currentUptime = Math.min(Math.max(100 - penalty + (successCount * 3), 0), 100);
  uptimePercent = currentUptime;
  
  uptimeText.innerText = uptimePercent.toFixed(1) + '%';
  uptimeRing.style.strokeDashoffset = 176 - (176 * uptimePercent) / 100;
  
  if (uptimePercent < 50) {
    uptimeRing.setAttribute('stroke', '#ff3366');
    uptimeText.className = "text-xl font-bold text-ops-threat crt-flicker";
    uptimeGlow.className = "absolute inset-0 bg-ops-threat opacity-20 neon-red-glow";
  } else {
    uptimeRing.setAttribute('stroke', '#00ffcc');
    uptimeText.className = "text-xl font-bold text-ops-accent";
    uptimeGlow.className = "absolute inset-0 bg-ops-accent opacity-20 neon-green-glow";
  }
}

// --- Common Logic ---

function logToCLI(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'font-mono text-xs py-1 border-l-2 pl-2 mb-1 ';
  const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
  
  switch(type) {
    case 'user': el.className += 'text-gray-300 border-gray-500'; el.innerHTML = `<span class="text-gray-500">[USER]</span> ${message}`; break;
    case 'sys-info': el.className += 'text-ops-accent border-ops-accent'; el.innerHTML = `<span class="text-green-800">[SYS]</span> ${message}`; break;
    case 'sys-crit': el.className += 'text-ops-threat border-ops-threat bg-red-900/20'; el.innerHTML = `<span class="text-red-800">[CRIT]</span> ${message}`; break;
    case 'sys-db': el.className += 'text-blue-400 border-blue-400 bg-blue-900/10'; el.innerHTML = `<span class="text-blue-600">[DB]</span> ${message}`; break;
    default: el.className += 'text-ops-accent border-ops-accent'; el.innerHTML = `<span class="text-green-800">[SYS]</span> ${message}`;
  }
  
  cliLog.appendChild(el);
  cliLog.scrollTop = cliLog.scrollHeight;
}

cliInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && cliInput.value.trim() !== '' && !isLockdown) {
    const val = cliInput.value.trim();
    logToCLI(val, 'user');
    processSOAR(val);
    cliInput.value = '';
  }
});

btnRecalibrate.addEventListener('click', async () => {
  if (isLockdown) return;
  successCount++;
  updateChart();
  
  // Celebratory UI
  cliLog.parentElement.classList.add('success-packet-anim');
  setTimeout(() => cliLog.parentElement.classList.remove('success-packet-anim'), 800);
  
  logToCLI("SUCCESS PACKET RECEIVED. Mental Uptime recalibrated.", "sys-info");
  await saveLog("Success-Drop Recalibration", "Manual-Recal", 0, 0, systemPressure, 'success');
  updatePressure(-15); // Wins reduce pressure
});

btnDemoMode.addEventListener('click', () => { lambda = 0.1; btnDemoMode.className = "px-3 py-1 bg-ops-accent text-black font-bold text-xs rounded"; btnRealMode.className = "px-3 py-1 bg-transparent text-gray-400 font-bold text-xs rounded"; });
btnRealMode.addEventListener('click', () => { lambda = 0.0001; btnRealMode.className = "px-3 py-1 bg-ops-accent text-black font-bold text-xs rounded"; btnDemoMode.className = "px-3 py-1 bg-transparent text-gray-400 font-bold text-xs rounded"; });

async function initChart() {
  const ctx = document.getElementById('ratio-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Success', 'Errors'],
      datasets: [{
        data: [successCount, errorCount],
        backgroundColor: ['rgba(0, 255, 204, 0.6)', 'rgba(255, 51, 102, 0.6)'],
        borderColor: ['#00ffcc', '#ff3366'],
        borderWidth: 1, borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
    }
  });
}

function updateChart() {
  if (chartInstance) {
    chartInstance.data.datasets[0].data = [successCount, errorCount];
    chartInstance.update();
  }
}

async function boot() {
  logToCLI("COGNITIVE SOAR ENGINE BOOTING...", "sys-info");
  await initDb();
  const historical = await getHistoricalMetrics();
  successCount = Number(historical.success);
  errorCount = Number(historical.threats);
  systemPressure = Number(historical.lastPressure);
  updatePressure(0);
  
  initChart();
  requestAnimationFrame(physicsLoop);
  logToCLI("ENGINE ROOM SECURE. AWAITING PAYLOADS.", "sys-info");
}

boot();
