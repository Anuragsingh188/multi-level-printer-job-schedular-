/**
 * Multi-Level Printer Job Scheduler - Core Engine
 * Implements Multi-Level Queue (MLQ) and Multi-Level Feedback Queue (MLFQ) algorithms.
 */

class PrintJob {
  constructor(options) {
    this.id = options.id || `JOB-${Math.floor(100 + Math.random() * 900)}`;
    this.name = options.name || 'Untitled_Document.pdf';
    this.user = options.user || 'Guest User';
    this.totalPages = parseInt(options.totalPages, 10) || 5;
    this.remainingPages = this.totalPages;
    this.priority = parseInt(options.priority, 10) || 2; // 1 = Urgent, 2 = Normal, 3 = Batch
    this.queueLevel = options.queueLevel || this.priority; // dynamic level in MLFQ
    this.initialQueueLevel = this.queueLevel;
    this.colorMode = options.colorMode || 'color'; // 'color' or 'bw'
    
    // Timing & Metrics
    this.arrivalTime = options.arrivalTime !== undefined ? options.arrivalTime : 0;
    this.startTime = null;
    this.finishTime = null;
    this.waitingTime = 0;
    this.turnaroundTime = 0;
    this.totalExecutionTime = 0;
    this.timeInCurrentQueue = 0; // used for aging
    
    // MLFQ tracking
    this.demotionsCount = 0;
    this.promotionsCount = 0;
    this.status = 'QUEUED'; // 'QUEUED', 'PRINTING', 'PREEMPTED', 'COMPLETED', 'CANCELLED'
    this.accentColor = options.accentColor || this.generateColor();
  }

  generateColor() {
    const palette = [
      '#4f46e5', '#2563eb', '#0284c7', '#0d9488', '#059669',
      '#16a34a', '#d97706', '#ea580c', '#e11d48', '#9333ea'
    ];
    return palette[Math.floor(Math.random() * palette.length)];
  }
}

class Scheduler {
  constructor(config = {}) {
    // Configuration
    this.mode = config.mode || 'MLFQ'; // 'MLFQ' or 'MLQ'
    this.preemptive = config.preemptive !== undefined ? config.preemptive : true;
    this.agingEnabled = config.agingEnabled !== undefined ? config.agingEnabled : true;
    this.agingThreshold = config.agingThreshold || 14; // in seconds
    this.quantumQ1 = config.quantumQ1 || 2; // pages per time slice for Level 1
    this.quantumQ2 = config.quantumQ2 || 4; // pages per time slice for Level 2

    // Simulation Clock
    this.currentTime = 0;
    this.isRunning = false;
    this.simulationSpeed = 1.0;

    // Queues
    this.q1 = []; // Level 1 (Urgent / Express)
    this.q2 = []; // Level 2 (Standard / Normal)
    this.q3 = []; // Level 3 (Batch / Background)

    // Execution state
    this.activeJob = null;
    this.activeSlicePagesPrinted = 0;
    this.completedJobs = [];
    this.ganttHistory = []; // { jobId, jobName, queueLevel, start, end, color }
    this.currentGanttEntry = null;

    // Event listeners
    this.listeners = {
      jobAdded: [],
      jobStarted: [],
      pagePrinted: [],
      jobPreempted: [],
      jobDemoted: [],
      jobPromoted: [],
      jobCompleted: [],
      jobCancelled: [],
      tick: []
    };
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Error in event listener ${event}:`, e); }
      });
    }
  }

  addJob(jobOptions) {
    const job = new PrintJob({
      ...jobOptions,
      arrivalTime: this.currentTime
    });

    // Place in initial queue
    if (job.queueLevel === 1) {
      this.q1.push(job);
    } else if (job.queueLevel === 2) {
      this.q2.push(job);
    } else {
      this.q3.push(job);
    }

    this.emit('jobAdded', job);

    // Check preemption upon arrival
    if (this.preemptive && this.activeJob) {
      if (job.queueLevel < this.activeJob.queueLevel) {
        this.preemptActiveJob(`Higher priority job (${job.id} - Level ${job.queueLevel}) arrived`);
      }
    }

    return job;
  }

  preemptActiveJob(reason = 'Preemption triggered') {
    if (!this.activeJob) return;

    const preempted = this.activeJob;
    preempted.status = 'PREEMPTED';
    this.closeGanttSlice();

    // Place preempted job back at the FRONT of its current queue so it resumes promptly
    if (preempted.queueLevel === 1) {
      this.q1.unshift(preempted);
    } else if (preempted.queueLevel === 2) {
      this.q2.unshift(preempted);
    } else {
      this.q3.unshift(preempted);
    }

    this.activeJob = null;
    this.activeSlicePagesPrinted = 0;

    this.emit('jobPreempted', { job: preempted, reason });
  }

  cancelJob(jobId) {
    if (this.activeJob && this.activeJob.id === jobId) {
      const cancelled = this.activeJob;
      cancelled.status = 'CANCELLED';
      this.closeGanttSlice();
      this.activeJob = null;
      this.activeSlicePagesPrinted = 0;
      this.emit('jobCancelled', cancelled);
      return true;
    }

    const removeFromQueue = (queue) => {
      const idx = queue.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        const [cancelled] = queue.splice(idx, 1);
        cancelled.status = 'CANCELLED';
        this.emit('jobCancelled', cancelled);
        return true;
      }
      return false;
    };

    return removeFromQueue(this.q1) || removeFromQueue(this.q2) || removeFromQueue(this.q3);
  }

  changeJobPriority(jobId, targetLevel) {
    if (this.activeJob && this.activeJob.id === jobId) {
      // Modify active job's queue level
      this.activeJob.queueLevel = targetLevel;
      return true;
    }

    let found = null;
    const searchAndRemove = (queue) => {
      const idx = queue.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        return queue.splice(idx, 1)[0];
      }
      return null;
    };

    found = searchAndRemove(this.q1) || searchAndRemove(this.q2) || searchAndRemove(this.q3);
    if (found) {
      const oldLevel = found.queueLevel;
      found.queueLevel = targetLevel;
      found.timeInCurrentQueue = 0;
      if (targetLevel === 1) this.q1.push(found);
      else if (targetLevel === 2) this.q2.push(found);
      else this.q3.push(found);

      if (targetLevel < oldLevel) {
        this.emit('jobPromoted', { job: found, fromLevel: oldLevel, toLevel: targetLevel, reason: 'Manual Reorder' });
      } else if (targetLevel > oldLevel) {
        this.emit('jobDemoted', { job: found, fromLevel: oldLevel, toLevel: targetLevel, reason: 'Manual Reorder' });
      }
      return true;
    }
    return false;
  }

  // Pick the highest priority ready job across the 3 queues
  selectNextJob() {
    if (this.activeJob) return;

    if (this.q1.length > 0) {
      this.activeJob = this.q1.shift();
    } else if (this.q2.length > 0) {
      this.activeJob = this.q2.shift();
    } else if (this.q3.length > 0) {
      this.activeJob = this.q3.shift();
    }

    if (this.activeJob) {
      this.activeJob.status = 'PRINTING';
      if (this.activeJob.startTime === null) {
        this.activeJob.startTime = this.currentTime;
      }
      this.activeSlicePagesPrinted = 0;
      this.startGanttSlice(this.activeJob);
      this.emit('jobStarted', this.activeJob);
    }
  }

  startGanttSlice(job) {
    this.currentGanttEntry = {
      jobId: job.id,
      jobName: job.name,
      queueLevel: job.queueLevel,
      color: job.accentColor,
      start: this.currentTime,
      end: this.currentTime,
      pagesPrinted: 0
    };
  }

  closeGanttSlice() {
    if (this.currentGanttEntry) {
      this.currentGanttEntry.end = this.currentTime;
      if (this.currentGanttEntry.end > this.currentGanttEntry.start) {
        this.ganttHistory.push({ ...this.currentGanttEntry });
      }
      this.currentGanttEntry = null;
    }
  }

  // Called when a page has finished printing
  onPagePrinted() {
    if (!this.activeJob) return;

    this.activeJob.remainingPages--;
    this.activeJob.totalExecutionTime += 1;
    this.activeSlicePagesPrinted++;

    if (this.currentGanttEntry) {
      this.currentGanttEntry.pagesPrinted++;
      this.currentGanttEntry.end = this.currentTime;
    }

    this.emit('pagePrinted', {
      job: this.activeJob,
      pagesLeft: this.activeJob.remainingPages,
      totalPages: this.activeJob.totalPages,
      slicePages: this.activeSlicePagesPrinted
    });

    // Check if job completed
    if (this.activeJob.remainingPages <= 0) {
      this.completeActiveJob();
      return;
    }

    // Check quantum exhaustion
    this.evaluateQuantumExhaustion();
  }

  evaluateQuantumExhaustion() {
    if (!this.activeJob) return;

    const job = this.activeJob;

    if (job.queueLevel === 1 && this.activeSlicePagesPrinted >= this.quantumQ1) {
      this.closeGanttSlice();
      if (this.mode === 'MLFQ') {
        // Demote to Level 2
        job.queueLevel = 2;
        job.demotionsCount++;
        job.timeInCurrentQueue = 0;
        job.status = 'QUEUED';
        this.q2.push(job);
        this.emit('jobDemoted', {
          job,
          fromLevel: 1,
          toLevel: 2,
          reason: `Quantum of ${this.quantumQ1} pages exhausted in Q1`
        });
      } else {
        // MLQ Round Robin within Q1
        job.status = 'QUEUED';
        this.q1.push(job);
      }
      this.activeJob = null;
      this.activeSlicePagesPrinted = 0;
      this.selectNextJob();
    } else if (job.queueLevel === 2 && this.activeSlicePagesPrinted >= this.quantumQ2) {
      this.closeGanttSlice();
      if (this.mode === 'MLFQ') {
        // Demote to Level 3
        job.queueLevel = 3;
        job.demotionsCount++;
        job.timeInCurrentQueue = 0;
        job.status = 'QUEUED';
        this.q3.push(job);
        this.emit('jobDemoted', {
          job,
          fromLevel: 2,
          toLevel: 3,
          reason: `Quantum of ${this.quantumQ2} pages exhausted in Q2`
        });
      } else {
        // MLQ Round Robin within Q2
        job.status = 'QUEUED';
        this.q2.push(job);
      }
      this.activeJob = null;
      this.activeSlicePagesPrinted = 0;
      this.selectNextJob();
    }
  }

  completeActiveJob() {
    if (!this.activeJob) return;

    const job = this.activeJob;
    job.finishTime = this.currentTime;
    job.turnaroundTime = Math.max(1, job.finishTime - job.arrivalTime);
    job.status = 'COMPLETED';

    this.closeGanttSlice();
    this.completedJobs.unshift(job); // newest first
    this.emit('jobCompleted', job);

    this.activeJob = null;
    this.activeSlicePagesPrinted = 0;

    // Pick next job immediately
    this.selectNextJob();
  }

  // Simulation tick (dt seconds, typically 1 second per page or fraction)
  tick(dt = 1) {
    this.currentTime += dt;

    // 1. Update waiting time and aging in all queues
    const updateQueue = (queue) => {
      for (const job of queue) {
        job.waitingTime += dt;
        job.timeInCurrentQueue += dt;
      }
    };
    updateQueue(this.q1);
    updateQueue(this.q2);
    updateQueue(this.q3);

    // 2. Check Aging (Anti-Starvation in MLFQ)
    if (this.agingEnabled && this.mode === 'MLFQ') {
      // Check Queue 3 for promotion to Queue 2
      for (let i = this.q3.length - 1; i >= 0; i--) {
        const job = this.q3[i];
        if (job.timeInCurrentQueue >= this.agingThreshold) {
          this.q3.splice(i, 1);
          job.queueLevel = 2;
          job.promotionsCount++;
          job.timeInCurrentQueue = 0;
          this.q2.push(job);
          this.emit('jobPromoted', {
            job,
            fromLevel: 3,
            toLevel: 2,
            reason: `Aging: Waited ${this.agingThreshold}s in Q3`
          });
        }
      }

      // Check Queue 2 for promotion to Queue 1
      for (let i = this.q2.length - 1; i >= 0; i--) {
        const job = this.q2[i];
        if (job.timeInCurrentQueue >= this.agingThreshold) {
          this.q2.splice(i, 1);
          job.queueLevel = 1;
          job.promotionsCount++;
          job.timeInCurrentQueue = 0;
          this.q1.push(job);
          this.emit('jobPromoted', {
            job,
            fromLevel: 2,
            toLevel: 1,
            reason: `Aging: Waited ${this.agingThreshold}s in Q2`
          });
        }
      }
    }

    // 3. Preemption check if a higher-level job became available
    if (this.preemptive && this.activeJob) {
      if (this.activeJob.queueLevel > 1 && this.q1.length > 0) {
        this.preemptActiveJob('Preempted by incoming Level 1 job');
      } else if (this.activeJob.queueLevel > 2 && this.q2.length > 0) {
        this.preemptActiveJob('Preempted by incoming Level 2 job');
      }
    }

    // 4. Ensure an active job is scheduled if printer is free
    if (!this.activeJob) {
      this.selectNextJob();
    }

    if (this.currentGanttEntry) {
      this.currentGanttEntry.end = this.currentTime;
    }

    this.emit('tick', {
      time: this.currentTime,
      activeJob: this.activeJob,
      q1: this.q1,
      q2: this.q2,
      q3: this.q3
    });
  }

  reset() {
    this.currentTime = 0;
    this.q1 = [];
    this.q2 = [];
    this.q3 = [];
    this.activeJob = null;
    this.activeSlicePagesPrinted = 0;
    this.completedJobs = [];
    this.ganttHistory = [];
    this.currentGanttEntry = null;
  }

  getMetrics() {
    const totalCompleted = this.completedJobs.length;
    if (totalCompleted === 0) {
      return {
        completedCount: 0,
        avgTurnaroundTime: 0,
        avgWaitingTime: 0,
        maxWaitingTime: 0,
        throughput: 0,
        printerUtilization: 0,
        totalExecutionTime: 0
      };
    }

    let totalTAT = 0;
    let totalWT = 0;
    let maxWT = 0;
    let totalExec = 0;

    for (const job of this.completedJobs) {
      totalTAT += job.turnaroundTime;
      totalWT += job.waitingTime;
      if (job.waitingTime > maxWT) maxWT = job.waitingTime;
      totalExec += job.totalExecutionTime;
    }

    const avgTurnaroundTime = (totalTAT / totalCompleted).toFixed(1);
    const avgWaitingTime = (totalWT / totalCompleted).toFixed(1);
    const throughput = this.currentTime > 0
      ? ((totalCompleted / this.currentTime) * 60).toFixed(1)
      : '0.0'; // jobs per minute

    const printerUtilization = this.currentTime > 0
      ? Math.min(100, ((totalExec / this.currentTime) * 100)).toFixed(1)
      : '0.0';

    return {
      completedCount: totalCompleted,
      avgTurnaroundTime,
      avgWaitingTime,
      maxWaitingTime,
      throughput,
      printerUtilization,
      totalExecutionTime: totalExec
    };
  }
}

window.Scheduler = Scheduler;
window.PrintJob = PrintJob;

