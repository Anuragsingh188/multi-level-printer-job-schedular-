/**
 * Multi-Level Printer Job Scheduler - Main Application Controller
 * Coordinates UI rendering, simulation loop, user input, and scenario presets.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Systems
  const scheduler = new Scheduler({
    mode: 'MLFQ',
    preemptive: true,
    agingEnabled: true,
    agingThreshold: 12,
    quantumQ1: 2,
    quantumQ2: 4
  });

  const printer = new PrinterSimulator(scheduler, window.soundEffects);
  const analytics = new AnalyticsManager(scheduler, 'ganttCanvas');

  // Simulation State
  let isRunning = true;
  let simSpeed = 1.0;
  let lastFrameTime = performance.now();
  let accumulatedTime = 0;

  // DOM Elements
  const elSimTime = document.getElementById('simTime');
  const elBtnPlayPause = document.getElementById('btnPlayPause');
  const elBtnStep = document.getElementById('btnStep');
  const elBtnReset = document.getElementById('btnReset');
  const elSpeedSelect = document.getElementById('speedSelect');
  const elBtnMute = document.getElementById('btnMute');

  const elQueue1List = document.getElementById('queue1List');
  const elQueue2List = document.getElementById('queue2List');
  const elQueue3List = document.getElementById('queue3List');
  const elQ1Count = document.getElementById('q1Count');
  const elQ2Count = document.getElementById('q2Count');
  const elQ3Count = document.getElementById('q3Count');

  // Active Job & Printer hardware UI
  const elPrinterStatusBadge = document.getElementById('printerStatusBadge');
  const elActiveJobCard = document.getElementById('activeJobCard');
  const elActiveDocName = document.getElementById('activeDocName');
  const elActiveDocUser = document.getElementById('activeDocUser');
  const elActiveQueueBadge = document.getElementById('activeQueueBadge');
  const elActivePageText = document.getElementById('activePageText');
  const elActivePageProgress = document.getElementById('activePageProgress');
  const elActiveJobOverallProgress = document.getElementById('activeJobOverallProgress');
  const elPrinterLed = document.getElementById('printerLed');
  const elPaperLevelBar = document.getElementById('paperLevelBar');
  const elPaperLevelText = document.getElementById('paperLevelText');
  const elTonerLevelBar = document.getElementById('tonerLevelBar');
  const elTonerLevelText = document.getElementById('tonerLevelText');

  // Metrics Elements
  const elMetricTAT = document.getElementById('metricTAT');
  const elMetricWT = document.getElementById('metricWT');
  const elMetricMaxWT = document.getElementById('metricMaxWT');
  const elMetricThroughput = document.getElementById('metricThroughput');
  const elMetricUtil = document.getElementById('metricUtil');
  const elMetricCompleted = document.getElementById('metricCompleted');

  // Completed Table
  const elCompletedTableBody = document.getElementById('completedTableBody');
  const elEmptyHistoryMsg = document.getElementById('emptyHistoryMsg');

  // Toast Container
  const elToastContainer = document.getElementById('toastContainer');

  // Preset Doc Names for rapid test
  const sampleDocTitles = [
    'Boarding_Pass_Urgent.pdf',
    'Financial_Quarterly_Q3.xlsx',
    'Computer_Science_Thesis.docx',
    'Hospital_Discharge_Summary.pdf',
    'Architecture_Blueprints_A3.dwg',
    'Marketing_Flyer_FullColor.pdf',
    'Contract_Agreement_Signed.pdf',
    'Conference_Badge_Express.pdf',
    'System_Audit_Log_Dump.txt',
    'Research_Whitepaper_v2.pdf'
  ];

  const sampleUsers = [
    'Dr. Evelyn Reed', 'Marcus Vance', 'Sarah Connor', 'Alex Chen',
    'Elena Rostova', 'David Kim', 'Priya Sharma', 'Jordan Taylor'
  ];

  // Show Toast Notification
  function showToast(message, type = 'info') {
    if (!elToastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-in`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚡';
    if (type === 'promote') icon = '🎉';
    if (type === 'demote') icon = '⬇️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-body">${message}</div>
    `;

    elToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 350);
    }, 3800);
  }

  // Bind Scheduler Event Listeners for Toast & Audio Feedback
  scheduler.on('jobAdded', (job) => {
    // UI update handled in render
  });

  scheduler.on('jobPreempted', ({ job, reason }) => {
    showToast(`<strong>${job.id}</strong> preempted: ${reason}`, 'warning');
  });

  scheduler.on('jobDemoted', ({ job, fromLevel, toLevel, reason }) => {
    showToast(`<strong>${job.id}</strong> demoted from Q${fromLevel} to Q${toLevel} (${reason})`, 'demote');
  });

  scheduler.on('jobPromoted', ({ job, fromLevel, toLevel, reason }) => {
    showToast(`<strong>${job.id}</strong> promoted to Q${toLevel} (${reason})`, 'promote');
  });

  scheduler.on('jobCompleted', (job) => {
    showToast(`<strong>${job.id}</strong> completed in ${job.turnaroundTime.toFixed(1)}s!`, 'success');
    renderCompletedTable();
  });

  // Render Job Cards inside a Queue
  function renderQueue(queue, containerEl, queueLevel) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    if (queue.length === 0) {
      containerEl.innerHTML = `
        <div class="queue-empty-state">
          <span>Queue is empty</span>
        </div>
      `;
      return;
    }

    queue.forEach((job, index) => {
      const card = document.createElement('div');
      card.className = `job-card queue-border-${job.queueLevel}`;
      
      const isUrgent = job.queueLevel === 1;
      const isNormal = job.queueLevel === 2;
      const isBatch = job.queueLevel === 3;

      const progressPercent = Math.round(((job.totalPages - job.remainingPages) / job.totalPages) * 100);

      card.innerHTML = `
        <div class="job-card-header">
          <div class="job-id-group">
            <span class="job-id-badge" style="background-color: ${job.accentColor}22; color: ${job.accentColor}; border: 1px solid ${job.accentColor}44;">
              ${job.id}
            </span>
            <span class="job-title" title="${job.name}">${job.name}</span>
          </div>
          <button class="btn-icon-tiny btn-cancel-job" data-id="${job.id}" title="Cancel Job">✕</button>
        </div>

        <div class="job-card-meta">
          <span>👤 ${job.user}</span>
          <span>📄 ${job.remainingPages} / ${job.totalPages} pgs</span>
          <span class="badge-mode ${job.colorMode === 'color' ? 'badge-color' : 'badge-bw'}">
            ${job.colorMode.toUpperCase()}
          </span>
        </div>

        <div class="job-progress-mini">
          <div class="job-progress-mini-bar" style="width: ${progressPercent}%; background-color: ${job.accentColor};"></div>
        </div>

        <div class="job-card-footer">
          <div class="job-timers">
            <span title="Total waiting time in queue">⏳ Wait: <strong>${Math.floor(job.waitingTime)}s</strong></span>
            ${scheduler.mode === 'MLFQ' && scheduler.agingEnabled && job.queueLevel > 1 ? `
              <span class="aging-timer" title="Time towards anti-starvation promotion">
                🔥 Aging: ${Math.max(0, scheduler.agingThreshold - Math.floor(job.timeInCurrentQueue))}s
              </span>
            ` : ''}
          </div>

          <div class="job-actions">
            ${job.queueLevel > 1 ? `
              <button class="btn-action-pill btn-promote-job" data-id="${job.id}" data-level="${job.queueLevel - 1}" title="Promote to higher priority">▲</button>
            ` : ''}
            ${job.queueLevel < 3 ? `
              <button class="btn-action-pill btn-demote-job" data-id="${job.id}" data-level="${job.queueLevel + 1}" title="Demote to lower priority">▼</button>
            ` : ''}
          </div>
        </div>
      `;

      containerEl.appendChild(card);
    });

    // Attach card event listeners
    containerEl.querySelectorAll('.btn-cancel-job').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        scheduler.cancelJob(id);
      });
    });

    containerEl.querySelectorAll('.btn-promote-job, .btn-demote-job').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const targetLevel = parseInt(btn.getAttribute('data-level'), 10);
        scheduler.changeJobPriority(id, targetLevel);
      });
    });
  }

  // Render Active Job & Printer Visual
  function renderPrinter() {
    const active = scheduler.activeJob;

    // Printer LED status
    if (elPrinterLed) {
      elPrinterLed.className = 'printer-led';
      if (printer.status === 'PRINTING') elPrinterLed.classList.add('led-printing');
      else if (printer.status === 'OUT_OF_PAPER' || printer.status === 'OUT_OF_TONER') elPrinterLed.classList.add('led-error');
      else if (printer.status === 'PAUSED') elPrinterLed.classList.add('led-paused');
      else elPrinterLed.classList.add('led-idle');
    }

    // Status Badge
    if (elPrinterStatusBadge) {
      elPrinterStatusBadge.textContent = printer.status.replace(/_/g, ' ');
      elPrinterStatusBadge.className = `status-badge status-${printer.status.toLowerCase()}`;
    }

    // Consumables
    if (elPaperLevelBar) elPaperLevelBar.style.width = `${(printer.paperTrayCount / printer.paperTrayMax) * 100}%`;
    if (elPaperLevelText) elPaperLevelText.textContent = `${printer.paperTrayCount} / ${printer.paperTrayMax} sheets`;
    if (elTonerLevelBar) elTonerLevelBar.style.width = `${printer.tonerLevel}%`;
    if (elTonerLevelText) elTonerLevelText.textContent = `${printer.tonerLevel}%`;

    // Active Job Details
    if (active) {
      if (elActiveJobCard) elActiveJobCard.classList.remove('hidden');
      if (elActiveDocName) elActiveDocName.textContent = active.name;
      if (elActiveDocUser) elActiveDocUser.textContent = `User: ${active.user} | ID: ${active.id}`;
      
      if (elActiveQueueBadge) {
        elActiveQueueBadge.textContent = `QUEUE ${active.queueLevel} (${active.queueLevel === 1 ? 'EXPRESS' : active.queueLevel === 2 ? 'STANDARD' : 'BATCH'})`;
        elActiveQueueBadge.className = `badge-queue-level badge-q${active.queueLevel}`;
      }

      const currentPage = printer.getCurrentPageNumber();
      if (elActivePageText) {
        elActivePageText.textContent = `Printing Page ${currentPage} of ${active.totalPages}`;
      }

      // Page progress bar
      if (elActivePageProgress) {
        elActivePageProgress.style.width = `${printer.pageProgress}%`;
      }

      // Overall job progress bar
      if (elActiveJobOverallProgress) {
        const completedPages = active.totalPages - active.remainingPages;
        const totalProgress = ((completedPages + (printer.pageProgress / 100)) / active.totalPages) * 100;
        elActiveJobOverallProgress.style.width = `${Math.min(100, totalProgress)}%`;
      }

      // Printer Hardware Graphic Paper Feeding Animation
      const paperFeedElem = document.getElementById('printerPaperFeed');
      if (paperFeedElem) {
        paperFeedElem.classList.add('is-printing-feed');
      }
    } else {
      if (elActiveJobCard) elActiveJobCard.classList.add('hidden');
      const paperFeedElem = document.getElementById('printerPaperFeed');
      if (paperFeedElem) {
        paperFeedElem.classList.remove('is-printing-feed');
      }
    }
  }

  // Render Metrics
  function renderMetrics() {
    const metrics = scheduler.getMetrics();
    if (elMetricTAT) elMetricTAT.textContent = `${metrics.avgTurnaroundTime}s`;
    if (elMetricWT) elMetricWT.textContent = `${metrics.avgWaitingTime}s`;
    if (elMetricMaxWT) elMetricMaxWT.textContent = `${metrics.maxWaitingTime}s`;
    if (elMetricThroughput) elMetricThroughput.textContent = `${metrics.throughput} /m`;
    if (elMetricUtil) elMetricUtil.textContent = `${metrics.printerUtilization}%`;
    if (elMetricCompleted) elMetricCompleted.textContent = metrics.completedCount;
  }

  // Render Completed Jobs Table
  function renderCompletedTable() {
    if (!elCompletedTableBody) return;
    const completed = scheduler.completedJobs;

    if (completed.length === 0) {
      if (elEmptyHistoryMsg) elEmptyHistoryMsg.classList.remove('hidden');
      elCompletedTableBody.innerHTML = '';
      return;
    }

    if (elEmptyHistoryMsg) elEmptyHistoryMsg.classList.add('hidden');
    elCompletedTableBody.innerHTML = '';

    completed.forEach(job => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong style="color: ${job.accentColor};">${job.id}</strong></td>
        <td class="font-medium">${job.name}</td>
        <td>${job.user}</td>
        <td>${job.totalPages} pgs</td>
        <td>
          <span class="badge-queue-level badge-q${job.initialQueueLevel}">Q${job.initialQueueLevel}</span>
          ${job.initialQueueLevel !== job.queueLevel ? `<span class="arrow-indicator">➔</span> <span class="badge-queue-level badge-q${job.queueLevel}">Q${job.queueLevel}</span>` : ''}
        </td>
        <td>${job.arrivalTime.toFixed(1)}s</td>
        <td>${job.finishTime !== null ? job.finishTime.toFixed(1) + 's' : '-'}</td>
        <td class="text-highlight"><strong>${job.turnaroundTime.toFixed(1)}s</strong></td>
        <td>${job.waitingTime.toFixed(1)}s</td>
        <td>
          ${job.demotionsCount > 0 ? `<span class="badge-chip badge-chip-demote" title="${job.demotionsCount} Demotions">⬇ ${job.demotionsCount}</span>` : ''}
          ${job.promotionsCount > 0 ? `<span class="badge-chip badge-chip-promote" title="${job.promotionsCount} Aging Promotions">⬆ ${job.promotionsCount}</span>` : ''}
          ${job.demotionsCount === 0 && job.promotionsCount === 0 ? '<span class="text-muted">-</span>' : ''}
        </td>
      `;
      elCompletedTableBody.appendChild(row);
    });
  }

  // Main UI Synchronization
  function syncUI() {
    // Queues
    renderQueue(scheduler.q1, elQueue1List, 1);
    renderQueue(scheduler.q2, elQueue2List, 2);
    renderQueue(scheduler.q3, elQueue3List, 3);

    // Queue Counts
    if (elQ1Count) elQ1Count.textContent = scheduler.q1.length;
    if (elQ2Count) elQ2Count.textContent = scheduler.q2.length;
    if (elQ3Count) elQ3Count.textContent = scheduler.q3.length;

    // Simulation Clock
    if (elSimTime) elSimTime.textContent = `${scheduler.currentTime.toFixed(1)}s`;

    // Status Tags
    const tagMode = document.getElementById('statusTagMode');
    const tagPreempt = document.getElementById('statusTagPreempt');
    const tagAging = document.getElementById('statusTagAging');
    if (tagMode) tagMode.textContent = scheduler.mode;
    if (tagPreempt) tagPreempt.textContent = scheduler.preemptive ? 'Enabled' : 'Disabled';
    if (tagAging) tagAging.textContent = scheduler.agingEnabled ? `${scheduler.agingThreshold}s` : 'Off';

    // Printer & Hardware
    renderPrinter();

    // Metrics & Gantt
    renderMetrics();
    analytics.renderGantt();
  }

  // Animation & Simulation Loop
  function simulationLoop(timestamp) {
    const deltaTimeMs = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (isRunning) {
      const deltaSec = (deltaTimeMs / 1000) * simSpeed;
      accumulatedTime += deltaSec;

      // Update printer hardware progression
      printer.update(deltaSec, 1.0);

      // Tick scheduler in discrete increments
      while (accumulatedTime >= 0.2) {
        scheduler.tick(0.2);
        accumulatedTime -= 0.2;
      }

      syncUI();
    }

    requestAnimationFrame(simulationLoop);
  }

  // Start Animation Frame
  requestAnimationFrame((ts) => {
    lastFrameTime = ts;
    simulationLoop(ts);
  });

  // Play / Pause Toggle
  function togglePlayPause() {
    isRunning = !isRunning;
    if (elBtnPlayPause) {
      elBtnPlayPause.innerHTML = isRunning
        ? `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg> <span>Pause</span>`
        : `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg> <span>Play</span>`;
    }
  }

  if (elBtnPlayPause) {
    elBtnPlayPause.addEventListener('click', togglePlayPause);
  }

  // Step 1 Second
  if (elBtnStep) {
    elBtnStep.addEventListener('click', () => {
      isRunning = false;
      if (elBtnPlayPause) {
        elBtnPlayPause.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg> <span>Play</span>`;
      }
      printer.update(1.0, 1.0);
      scheduler.tick(1.0);
      syncUI();
    });
  }

  // Reset Simulation
  if (elBtnReset) {
    elBtnReset.addEventListener('click', () => {
      scheduler.reset();
      printer.activeJob = null;
      printer.pageProgress = 0;
      printer.status = 'IDLE';
      renderCompletedTable();
      syncUI();
      showToast('Simulation reset to initial state', 'info');
    });
  }

  // Speed Selector
  if (elSpeedSelect) {
    elSpeedSelect.addEventListener('change', (e) => {
      simSpeed = parseFloat(e.target.value);
    });
  }

  // Keyboard Shortcuts (Space: Play/Pause, S: Step, R: Reset)
  window.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts if user is typing in a form input or modal
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 's' || e.key === 'S') {
      if (elBtnStep) elBtnStep.click();
    } else if (e.key === 'r' || e.key === 'R') {
      if (elBtnReset) elBtnReset.click();
    }
  });

  // Audio Mute Toggle
  if (elBtnMute) {
    elBtnMute.addEventListener('click', () => {
      const isMuted = window.soundEffects.toggleMute();
      elBtnMute.textContent = isMuted ? '🔇 Unmute' : '🔊 Audio On';
      elBtnMute.classList.toggle('btn-muted', isMuted);
    });
  }

  // Refill Paper & Replace Toner buttons
  const btnRefillPaper = document.getElementById('btnRefillPaper');
  if (btnRefillPaper) {
    btnRefillPaper.addEventListener('click', () => {
      printer.refillPaper();
      syncUI();
      showToast('Paper tray refilled to 100 sheets!', 'success');
    });
  }

  const btnReplaceToner = document.getElementById('btnReplaceToner');
  if (btnReplaceToner) {
    btnReplaceToner.addEventListener('click', () => {
      printer.replaceToner();
      syncUI();
      showToast('Toner cartridge replaced (100%)!', 'success');
    });
  }

  // Job Submission Form
  const formNewJob = document.getElementById('formNewJob');
  const inputDocName = document.getElementById('inputDocName');
  const inputPages = document.getElementById('inputPages');
  const selectQueue = document.getElementById('selectQueue');
  const selectColor = document.getElementById('selectColor');
  const inputUser = document.getElementById('inputUser');

  if (formNewJob) {
    formNewJob.addEventListener('submit', (e) => {
      e.preventDefault();
      window.soundEffects.playClick();

      const name = inputDocName.value.trim() || sampleDocTitles[Math.floor(Math.random() * sampleDocTitles.length)];
      const pages = parseInt(inputPages.value, 10) || 5;
      const queueLevel = parseInt(selectQueue.value, 10) || 2;
      const colorMode = selectColor.value || 'color';
      const user = inputUser.value.trim() || sampleUsers[Math.floor(Math.random() * sampleUsers.length)];

      const job = scheduler.addJob({
        name,
        totalPages: pages,
        queueLevel,
        colorMode,
        user
      });

      showToast(`Submitted: ${job.name} (${job.totalPages} pgs) to Queue ${job.queueLevel}`, 'info');

      // Reset to a random default title for convenience
      inputDocName.value = '';
      inputPages.value = Math.floor(2 + Math.random() * 8);
      syncUI();
    });
  }

  // Quick Random Job Button
  const btnQuickRandom = document.getElementById('btnQuickRandom');
  if (btnQuickRandom) {
    btnQuickRandom.addEventListener('click', () => {
      window.soundEffects.playClick();
      const randomDoc = sampleDocTitles[Math.floor(Math.random() * sampleDocTitles.length)];
      const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
      const randomPages = Math.floor(1 + Math.random() * 12);
      const randomLevel = Math.floor(1 + Math.random() * 3);
      const randomColor = Math.random() > 0.4 ? 'color' : 'bw';

      const job = scheduler.addJob({
        name: randomDoc,
        user: randomUser,
        totalPages: randomPages,
        queueLevel: randomLevel,
        colorMode: randomColor
      });

      showToast(`Random job generated: ${job.id} (${job.totalPages} pgs, Q${job.queueLevel})`, 'info');
      syncUI();
    });
  }

  // Gantt Zoom Controls
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomReset = document.getElementById('btnZoomReset');

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      analytics.setZoom(analytics.zoomLevel * 1.3);
    });
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      analytics.setZoom(analytics.zoomLevel / 1.3);
    });
  }
  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => {
      analytics.setZoom(1.0);
    });
  }

  // Export Buttons
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnExportJSON = document.getElementById('btnExportJSON');
  if (btnExportCSV) btnExportCSV.addEventListener('click', () => analytics.exportToCSV());
  if (btnExportJSON) btnExportJSON.addEventListener('click', () => analytics.exportToJSON());

  // Configuration Modal
  const modalConfig = document.getElementById('modalConfig');
  const btnOpenConfig = document.getElementById('btnOpenConfig');
  const btnCloseConfig = document.getElementById('btnCloseConfig');
  const formConfig = document.getElementById('formConfig');

  if (btnOpenConfig && modalConfig) {
    btnOpenConfig.addEventListener('click', () => {
      modalConfig.classList.remove('hidden');
      // Populate inputs with current scheduler config
      document.getElementById('cfgMode').value = scheduler.mode;
      document.getElementById('cfgPreemptive').checked = scheduler.preemptive;
      document.getElementById('cfgAging').checked = scheduler.agingEnabled;
      document.getElementById('cfgAgingThreshold').value = scheduler.agingThreshold;
      document.getElementById('cfgQuantumQ1').value = scheduler.quantumQ1;
      document.getElementById('cfgQuantumQ2').value = scheduler.quantumQ2;
    });
  }

  if (btnCloseConfig && modalConfig) {
    btnCloseConfig.addEventListener('click', () => {
      modalConfig.classList.add('hidden');
    });
  }

  if (formConfig) {
    formConfig.addEventListener('submit', (e) => {
      e.preventDefault();
      scheduler.mode = document.getElementById('cfgMode').value;
      scheduler.preemptive = document.getElementById('cfgPreemptive').checked;
      scheduler.agingEnabled = document.getElementById('cfgAging').checked;
      scheduler.agingThreshold = parseInt(document.getElementById('cfgAgingThreshold').value, 10) || 12;
      scheduler.quantumQ1 = parseInt(document.getElementById('cfgQuantumQ1').value, 10) || 2;
      scheduler.quantumQ2 = parseInt(document.getElementById('cfgQuantumQ2').value, 10) || 4;

      modalConfig.classList.add('hidden');
      showToast('Algorithm settings updated successfully!', 'success');
      syncUI();
    });
  }

  // Pre-configured Scenarios
  const btnScenarioBurst = document.getElementById('scenarioBurst');
  const btnScenarioElephant = document.getElementById('scenarioElephant');
  const btnScenarioStarvation = document.getElementById('scenarioStarvation');
  const btnScenarioCampus = document.getElementById('scenarioCampus');

  // Scenario 1: Express Burst (Multiple short jobs arrive together)
  if (btnScenarioBurst) {
    btnScenarioBurst.addEventListener('click', () => {
      scheduler.reset();
      showToast('Loading Scenario: Express VIP Burst', 'info');

      scheduler.addJob({ name: 'Emergency_Medical_Scan.pdf', user: 'Dr. Evelyn', totalPages: 2, queueLevel: 1, colorMode: 'color' });
      scheduler.addJob({ name: 'Flight_BoardingPass.pdf', user: 'Marcus Vance', totalPages: 1, queueLevel: 1, colorMode: 'bw' });
      scheduler.addJob({ name: 'Security_Clearance_Pass.pdf', user: 'Director Stone', totalPages: 2, queueLevel: 1, colorMode: 'color' });
      scheduler.addJob({ name: 'Expedited_Invoice.pdf', user: 'Sarah Connor', totalPages: 3, queueLevel: 1, colorMode: 'bw' });

      syncUI();
    });
  }

  // Scenario 2: Elephant vs Mice (Massive batch job interrupted by urgent jobs)
  if (btnScenarioElephant) {
    btnScenarioElephant.addEventListener('click', () => {
      scheduler.reset();
      showToast('Loading Scenario: Elephant vs Mice (Preemption)', 'warning');

      // The Elephant (large batch job)
      scheduler.addJob({
        name: 'Huge_Annual_Archive_Report_2026.pdf',
        user: 'Archive Bot',
        totalPages: 24,
        queueLevel: 3,
        colorMode: 'bw'
      });

      // Mice (urgent 1-page jobs submitted with slight simulated delay)
      setTimeout(() => {
        scheduler.addJob({ name: 'Urgent_Lab_Result.pdf', user: 'Dr. Watson', totalPages: 1, queueLevel: 1, colorMode: 'color' });
      }, 1500);

      setTimeout(() => {
        scheduler.addJob({ name: 'VIP_Gate_Pass.pdf', user: 'VIP Guest', totalPages: 2, queueLevel: 1, colorMode: 'bw' });
      }, 3500);

      syncUI();
    });
  }

  // Scenario 3: Starvation & Aging Demo (Batch job aging into promotion)
  if (btnScenarioStarvation) {
    btnScenarioStarvation.addEventListener('click', () => {
      scheduler.reset();
      scheduler.agingThreshold = 8; // Low threshold for rapid demonstration
      showToast('Loading Scenario: Starvation & Aging Demo (Aging threshold = 8s)', 'promote');

      // Starving batch job
      scheduler.addJob({
        name: 'LowPriority_System_Backup_Logs.txt',
        user: 'SysAdmin',
        totalPages: 10,
        queueLevel: 3,
        colorMode: 'bw'
      });

      // Stream of higher priority jobs
      for (let i = 1; i <= 3; i++) {
        scheduler.addJob({
          name: `Standard_Team_Minutes_${i}.pdf`,
          user: `Member_${i}`,
          totalPages: 3,
          queueLevel: 2,
          colorMode: 'color'
        });
      }

      syncUI();
    });
  }

  // Scenario 4: Campus Print Lab (Realistic mixed load)
  if (btnScenarioCampus) {
    btnScenarioCampus.addEventListener('click', () => {
      scheduler.reset();
      showToast('Loading Scenario: Campus Print Lab Workload', 'info');

      scheduler.addJob({ name: 'Midterm_Exam_Papers.pdf', user: 'Prof. Davis', totalPages: 6, queueLevel: 1, colorMode: 'bw' });
      scheduler.addJob({ name: 'Biology_Lab_Report.pdf', user: 'Emma Watson', totalPages: 4, queueLevel: 2, colorMode: 'color' });
      scheduler.addJob({ name: 'Engineering_Thesis_Draft.pdf', user: 'Rahul Verma', totalPages: 15, queueLevel: 3, colorMode: 'bw' });
      scheduler.addJob({ name: 'Campus_Event_Flyer.pdf', user: 'Student Council', totalPages: 2, queueLevel: 1, colorMode: 'color' });
      scheduler.addJob({ name: 'History_Essay_Final.docx', user: 'Sophia Lee', totalPages: 5, queueLevel: 2, colorMode: 'bw' });
      scheduler.addJob({ name: 'University_Course_Catalog.pdf', user: 'Registrar Office', totalPages: 20, queueLevel: 3, colorMode: 'color' });

      syncUI();
    });
  }

  // Seed default starting job so the page looks lively immediately
  scheduler.addJob({
    name: 'Executive_Briefing_Memo.pdf',
    user: 'Chief Executive',
    totalPages: 3,
    queueLevel: 1,
    colorMode: 'color'
  });
  scheduler.addJob({
    name: 'Marketing_Pitch_Deck.pptx',
    user: 'Marketing Lead',
    totalPages: 6,
    queueLevel: 2,
    colorMode: 'color'
  });
  scheduler.addJob({
    name: 'Monthly_Server_Telemetry_Dump.log',
    user: 'DevOps Automated',
    totalPages: 16,
    queueLevel: 3,
    colorMode: 'bw'
  });

  syncUI();
});
