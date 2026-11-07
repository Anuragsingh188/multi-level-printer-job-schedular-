/**
 * Multi-Level Printer Job Scheduler - Printer Hardware Simulator
 * Simulates mechanical printer state, page feeding, toner, paper supply, and animation.
 */

class PrinterSimulator {
  constructor(scheduler, soundEffects) {
    this.scheduler = scheduler;
    this.sfx = soundEffects;

    // Hardware State
    this.status = 'IDLE'; // IDLE, PRINTING, FEEDING, PAUSED, OUT_OF_PAPER, OUT_OF_TONER
    this.paperTrayCount = 50; // sheets
    this.paperTrayMax = 100;
    this.tonerLevel = 98; // percentage
    this.totalSheetsPrinted = 0;

    // Page progress
    this.activeJob = null;
    this.pageProgress = 0; // 0 to 100%
    this.pageDurationSec = 1.0; // base seconds per page at 1x speed

    // Animation & Cycle timers
    this.cycleTimer = null;
    this.lastTimestamp = null;

    this.initEventListeners();
  }

  initEventListeners() {
    this.scheduler.on('jobStarted', (job) => {
      this.activeJob = job;
      this.pageProgress = 0;
      if (this.status !== 'OUT_OF_PAPER' && this.status !== 'OUT_OF_TONER') {
        this.status = 'PRINTING';
        this.sfx.playPaperFeed();
      }
    });

    this.scheduler.on('jobPreempted', ({ job, reason }) => {
      this.activeJob = null;
      this.pageProgress = 0;
      this.status = 'IDLE';
      this.sfx.playDemotion();
    });

    this.scheduler.on('jobDemoted', () => {
      this.sfx.playDemotion();
    });

    this.scheduler.on('jobPromoted', () => {
      this.sfx.playPromotion();
    });

    this.scheduler.on('jobCompleted', () => {
      this.activeJob = null;
      this.pageProgress = 0;
      this.status = 'IDLE';
      this.sfx.playJobDone();
    });

    this.scheduler.on('jobCancelled', (job) => {
      if (this.activeJob && this.activeJob.id === job.id) {
        this.activeJob = null;
        this.pageProgress = 0;
        this.status = 'IDLE';
      }
    });
  }

  refillPaper() {
    this.paperTrayCount = this.paperTrayMax;
    if (this.status === 'OUT_OF_PAPER') {
      this.status = this.activeJob ? 'PRINTING' : 'IDLE';
    }
    this.sfx.playPaperFeed();
  }

  replaceToner() {
    this.tonerLevel = 100;
    if (this.status === 'OUT_OF_TONER') {
      this.status = this.activeJob ? 'PRINTING' : 'IDLE';
    }
    this.sfx.playClick();
  }

  // Called in the animation / simulation loop
  update(deltaTimeSeconds, simSpeed) {
    // If scheduler has an active job but printer was idle, sync
    if (this.scheduler.activeJob && (!this.activeJob || this.activeJob !== this.scheduler.activeJob)) {
      this.activeJob = this.scheduler.activeJob;
      this.status = 'PRINTING';
      this.sfx.playPaperFeed();
    } else if (!this.scheduler.activeJob) {
      this.activeJob = null;
      this.pageProgress = 0;
      if (this.status === 'PRINTING') {
        this.status = 'IDLE';
      }
      return;
    }

    // Check consumables
    if (this.paperTrayCount <= 0) {
      this.status = 'OUT_OF_PAPER';
      return;
    }

    if (this.tonerLevel <= 0) {
      this.status = 'OUT_OF_TONER';
      return;
    }

    // Active printing progress
    if (this.status === 'PRINTING' && this.activeJob) {
      // Advance page progress
      const progressDelta = (deltaTimeSeconds * simSpeed / this.pageDurationSec) * 100;
      this.pageProgress += progressDelta;

      if (Math.random() < 0.15) {
        this.sfx.playPrintStep();
      }

      if (this.pageProgress >= 100) {
        // Page fully printed!
        this.pageProgress = 0;
        this.paperTrayCount = Math.max(0, this.paperTrayCount - 1);
        this.tonerLevel = Math.max(0, parseFloat((this.tonerLevel - (this.activeJob.colorMode === 'color' ? 0.4 : 0.2)).toFixed(1)));
        this.totalSheetsPrinted++;

        // Tell scheduler page is done
        this.scheduler.onPagePrinted();

        // Feed sound for subsequent page if job still has pages
        if (this.activeJob && this.activeJob.remainingPages > 0) {
          this.sfx.playPaperFeed();
        }
      }
    }
  }

  getCurrentPageNumber() {
    if (!this.activeJob) return 0;
    return (this.activeJob.totalPages - this.activeJob.remainingPages) + 1;
  }
}

window.PrinterSimulator = PrinterSimulator;

