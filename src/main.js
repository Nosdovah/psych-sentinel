// Psych-Sentinel v1.0 Core Engine (SOAR Upgrade)
import { initDb, saveLog, getHistoricalMetrics, getHistoricalLogs, deleteLog } from './db.js';
import { generateRemediation } from './ai.js';

// State
let isDemoMode = true;
let lambda = 0.1; 
let uptimePercent = 100.0;
let successCount = 0;
let errorCount = 0;
let systemPressure = 0;
let isLockdown = false;
let currentIncidentData = null; 

let activeThreats = []; // Track active risks for uptime
let chartInstance = null;

// DOM Elements
const cliInput = document.getElementById('cli-input');
const cliLog = document.getElementById('cli-log');
const incidentLogBody = document.getElementById('incident-log-body');
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
const btnResolveSop = document.getElementById('btn-resolve-sop');

// --- SOC Log Logic ---

function renderLogEntry(entry, animate = false) {
  const row = document.createElement('tr');
  const typeClass = entry.type === 'success' ? 'success' : (entry.risk_score >= 8 || entry.severity >= 8 ? 'critical' : 'threat');
  row.className = `log-row ${typeClass} h-10 cursor-pointer active:bg-white/20`;
  row.id = `log-entry-${entry.id}`;
  
  if (animate) {
    row.classList.add('opacity-0', '-translate-x-4');
  }

  const date = new Date(entry.timestamp);
  const timeStr = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const idPrefix = entry.type === 'success' ? 'WIN' : 'THM';
  const incidentIdStr = `${idPrefix}-${entry.id || Math.floor(Math.random()*1000)}`;
  const risk = entry.risk_score || entry.severity || 0;

  row.innerHTML = `
    <td class="pl-3 text-gray-500">${timeStr}</td>
    <td class="font-bold text-ops-accent">${incidentIdStr}</td>
    <td class="text-gray-300 uppercase">${entry.ttp_category || 'NEUTRAL'}</td>
    <td class="text-center font-bold ${risk >= 8 ? 'text-ops-threat' : 'text-ops-accent'}">${risk}</td>
    <td class="pr-3 text-right text-[8px] ${entry.type === 'success' ? 'text-ops-accent' : 'text-ops-threat'} uppercase">${entry.type === 'success' ? 'Validated' : 'Remediated'}</td>
  `;

  // Track if it's a threat for uptime
  if (entry.type === 'threat') {
    activeThreats.push({
      id: entry.id,
      initialRisk: risk,
      currentRisk: risk,
      timestamp: Date.now()
    });
  }

  row.onclick = () => {
    let playbook = entry.remediation || (entry.remediation_json ? JSON.parse(entry.remediation_json) : ["No historical remediation record found."]);
    
    currentIncidentData = {
        id: entry.id,
        ttp: entry.ttp_category || entry.ttp,
        riskScore: risk,
        remediation: playbook
    };

    triggerSOP(currentIncidentData, true);
  };

  if (animate) {
    incidentLogBody.prepend(row);
    setTimeout(() => row.classList.remove('opacity-0', '-translate-x-4'), 50);
  } else {
    incidentLogBody.appendChild(row);
  }

  applyOpacityDecay();
}

function applyOpacityDecay() {
  const rows = incidentLogBody.querySelectorAll('.log-row');
  rows.forEach((row, index) => {
    const decayLambda = 0.15; 
    const opacity = Math.max(0.1, Math.exp(-decayLambda * index));
    row.style.opacity = opacity;
  });
}

// --- AI Pipeline & SOAR Logic ---

async function processSOAR(text) {
  if (isLockdown) return;

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
    
    systemStatus.innerText = "THREAT_IDENTIFIED";
    systemStatus.className = "text-ops-threat";

    errorCount++;
    updateChart();

    const incidentId = Date.now().toString().slice(-4);

    // Spawn SOC Log Entry
    renderLogEntry({
      timestamp: new Date().toISOString(),
      id: incidentId,
      ttp_category: result.ttp,
      severity: 5,
      risk_score: result.riskScore,
      remediation: result.remediation,
      type: 'threat'
    }, true);

    const pressureIncrease = result.riskScore * 5;
    updatePressure(pressureIncrease);

    triggerSOP(result);

    await saveLog(text, result.ttp, 5, result.riskScore, systemPressure, result.remediation, 'threat');
    logToCLI(`SOAR Artifact generated. TTP: ${result.ttp}. Risk: ${result.riskScore}`, "sys-db");

  } catch (err) {
    logToCLI("Reasoning Engine Timeout. Reverting to local heuristic.", "sys-crit");
    systemStatus.innerText = "FALLBACK_MODE";
  }

  updateChart();
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
    if (pressureFill.classList.contains('bg-ops-accent')) {
        pressureFill.classList.replace('bg-ops-accent', 'bg-yellow-500');
    }
  }
}

function triggerLockdown() {
  if (isLockdown) return;
  isLockdown = true;
  coolingOverlay.classList.remove('hidden');
  logToCLI("CRITICAL: SYSTEM PRESSURE EXCEEDED 80%. ENTERING COOLING PERIOD.", "sys-crit");
  
  let secondsLeft = 300; 
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

function triggerSOP(result, historical = false) {
  sopTtpName.innerText = `TTP: ${result.ttp}`;
  sopRiskBadge.innerText = `RISK: ${result.riskScore}`;
  sopContent.innerHTML = result.remediation.map(step => `<p class="flex gap-2"><span class="text-ops-sop">→</span> ${step}</p>`).join("");
  
  if (historical) {
      btnResolveSop.innerText = "DELETE PERMANENTLY";
      btnResolveSop.classList.replace('bg-ops-sop', 'bg-ops-threat');
      btnResolveSop.classList.replace('text-black', 'text-white');
  } else {
      btnResolveSop.innerText = "RESOLVE TICKET";
      btnResolveSop.classList.replace('bg-ops-threat', 'bg-ops-sop');
      btnResolveSop.classList.replace('text-white', 'text-black');
  }

  sopModal.classList.remove('hidden');
  setTimeout(() => {
    sopCard.classList.remove('opacity-0', 'scale-95', 'translate-y-10');
  }, 10);
}

btnResolveSop.onclick = async () => {
    if (currentIncidentData && currentIncidentData.id) {
        const rowId = currentIncidentData.id;
        const row = document.getElementById(`log-entry-${rowId}`);
        if (row) {
            row.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => {
                row.remove();
                applyOpacityDecay();
            }, 600);
        }
        
        // Remove from activeThreats tracking
        activeThreats = activeThreats.filter(t => t.id != rowId);
        
        await deleteLog(rowId);
        logToCLI(`Incident [${rowId}] resolved and deleted from database.`, "sys-db");
    }

    sopCard.classList.add('opacity-0', 'scale-95', 'translate-y-10');
    setTimeout(() => {
        sopModal.classList.add('hidden');
        systemStatus.innerText = "SYSTEM_IDLE";
        systemStatus.className = "text-ops-accent";
        currentIncidentData = null;
    }, 500);
};

btnDismissSop.addEventListener('click', () => {
  sopCard.classList.add('opacity-0', 'scale-95', 'translate-y-10');
  setTimeout(() => {
    sopModal.classList.add('hidden');
    systemStatus.innerText = "SYSTEM_IDLE";
    systemStatus.className = "text-ops-accent";
  }, 500);
});

function physicsLoop() {
  const now = Date.now();
  
  // Update risk decay for uptime
  activeThreats.forEach(t => {
    const timeElapsed = (now - t.timestamp) / 1000;
    t.currentRisk = t.initialRisk * Math.exp(-lambda * timeElapsed);
  });

  recalculateUptime();
  requestAnimationFrame(physicsLoop);
}

function recalculateUptime() {
  let penalty = 0;
  // Penalty: 1 risk point = 2% uptime loss (Max risk 10 = 20% loss)
  activeThreats.forEach(t => { 
    penalty += t.currentRisk * 3; 
  });
  
  // Offset: Validated wins add buffer
  let currentUptime = Math.min(Math.max(100 - penalty + (successCount * 0.5), 0), 100);
  uptimePercent = currentUptime;
  
  uptimeText.innerText = uptimePercent.toFixed(1) + '%';
  uptimeRing.style.strokeDashoffset = 176 - (176 * uptimePercent) / 100;
  
  if (uptimePercent < 70) {
    uptimeRing.setAttribute('stroke', '#ff3366');
    uptimeText.className = "text-xl font-bold text-ops-threat crt-flicker";
    uptimeGlow.className = "absolute inset-0 bg-ops-threat opacity-20 neon-red-glow";
  } else if (uptimePercent < 90) {
    uptimeRing.setAttribute('stroke', '#eab308');
    uptimeText.className = "text-xl font-bold text-ops-sop";
    uptimeGlow.className = "absolute inset-0 bg-ops-sop opacity-20 neon-yellow-glow";
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
  
  cliLog.parentElement.classList.add('success-packet-anim');
  setTimeout(() => cliLog.parentElement.classList.remove('success-packet-anim'), 800);
  
  logToCLI("SUCCESS PACKET RECEIVED. Mental Uptime recalibrated.", "sys-info");
  
  renderLogEntry({
    timestamp: new Date().toISOString(),
    id: Date.now().toString().slice(-4),
    ttp_category: "Manual Recalibration",
    severity: 0,
    risk_score: 0,
    remediation: ["Success dropped into log. Reality validated."],
    type: 'success'
  }, true);

  await saveLog("Success-Drop Recalibration", "Manual-Recal", 0, 0, systemPressure, ["Success dropped into log. Reality validated."], 'success');
  updatePressure(-15); 
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
  
  const logs = await getHistoricalLogs();
  logs.forEach(log => {
      renderLogEntry({
          id: log.id,
          timestamp: log.timestamp,
          ttp_category: log.ttp_category,
          severity: log.severity,
          risk_score: log.risk_score,
          remediation_json: log.remediation_json,
          type: log.type
      });
  });

  initChart();
  requestAnimationFrame(physicsLoop);
  logToCLI("ENGINE ROOM SECURE. AWAITING PAYLOADS.", "sys-info");
}

boot();
