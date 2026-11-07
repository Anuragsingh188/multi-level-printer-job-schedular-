/**
 * Multi-Level Printer Job Scheduler - Analytics & Gantt Chart
 * Renders real-time Gantt Chart, calculates scheduling metrics, and handles data export.
 */

class AnalyticsManager {
  constructor(scheduler, canvasId) {
    this.scheduler = scheduler;
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.pixelsPerSecond = 28; // scale factor
    this.zoomLevel = 1.0;
    this.rowHeight = 44;
    this.hoveredSlice = null;

    if (this.canvas) {
      this.initCanvasInteractions();
      window.addEventListener('resize', () => {
        this.resizeCanvas();
        this.renderGantt();
      });
      this.resizeCanvas();
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent && parent.clientWidth > 100) {
      const targetWidth = parent.clientWidth - 16;
      if (this.canvas.width !== targetWidth) {
        this.canvas.width = targetWidth;
      }
    }
  }

  initCanvasInteractions() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Find hovered slice
      const timeAtMouse = (mouseX - 60) / (this.pixelsPerSecond * this.zoomLevel);
      let found = null;

      const allSlices = [...this.scheduler.ganttHistory];
      if (this.scheduler.currentGanttEntry) {
        allSlices.push(this.scheduler.currentGanttEntry);
      }

      for (const slice of allSlices) {
        if (timeAtMouse >= slice.start && timeAtMouse <= slice.end) {
          found = slice;
          break;
        }
      }

      this.hoveredSlice = found;
      this.renderGantt();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredSlice = null;
      this.renderGantt();
    });
  }

  setZoom(factor) {
    this.zoomLevel = Math.max(0.5, Math.min(3.0, factor));
    this.renderGantt();
  }

  renderGantt() {
    if (!this.ctx || !this.canvas) return;
    this.resizeCanvas();

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const currentTime = this.scheduler.currentTime;
    const pps = this.pixelsPerSecond * this.zoomLevel;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Left label margin
    const leftMargin = 75;
    const chartWidth = width - leftMargin;

    // Auto-scroll offset so current time stays visible
    let timeOffset = 0;
    const maxVisibleDuration = chartWidth / pps;
    if (currentTime > maxVisibleDuration * 0.75) {
      timeOffset = currentTime - maxVisibleDuration * 0.75;
    }

    // 1. Draw Time Axis and Grid lines
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tickInterval = this.zoomLevel < 0.8 ? 5 : (this.zoomLevel > 1.8 ? 1 : 2);
    const startTick = Math.floor(timeOffset / tickInterval) * tickInterval;
    const endTick = startTick + Math.ceil(maxVisibleDuration) + tickInterval;

    for (let t = startTick; t <= endTick; t += tickInterval) {
      const x = leftMargin + (t - timeOffset) * pps;
      if (x < leftMargin || x > width) continue;

      // Vertical gridline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time label
      ctx.fillText(`${t}s`, x, 14);
    }

    // 2. Queue Level Label on Left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillText('PRINTER', 12, height / 2 + 10);
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('TIMELINE', 12, height / 2 + 25);

    // 3. Draw Gantt Blocks
    const allSlices = [...this.scheduler.ganttHistory];
    if (this.scheduler.currentGanttEntry) {
      allSlices.push(this.scheduler.currentGanttEntry);
    }

    const barY = 32;
    const barHeight = height - barY - 14;

    allSlices.forEach((slice) => {
      const x1 = leftMargin + (slice.start - timeOffset) * pps;
      const x2 = leftMargin + (slice.end - timeOffset) * pps;
      const sliceWidth = Math.max(3, x2 - x1);

      if (x2 < leftMargin || x1 > width) return;

      // Color scheme based on queue level
      let blockColor = slice.color;
      let borderColor = '#ffffff33';

      if (slice.queueLevel === 1) {
        blockColor = '#ef4444'; // Red for Urgent Q1
      } else if (slice.queueLevel === 2) {
        blockColor = '#f59e0b'; // Amber for Normal Q2
      } else {
        blockColor = '#10b981'; // Green for Batch Q3
      }

      ctx.save();
      // Block shadow / glow
      ctx.shadowColor = blockColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = blockColor;

      // Draw rounded rectangle
      this.drawRoundedRect(ctx, x1, barY, sliceWidth, barHeight, 6);
      ctx.fill();
      ctx.restore();

      // Border highlight
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      this.drawRoundedRect(ctx, x1, barY, sliceWidth, barHeight, 6);
      ctx.stroke();

      // Inner text label if block is wide enough
      if (sliceWidth > 38) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x1 + 3, barY, sliceWidth - 6, barHeight);
        ctx.clip();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(slice.jobId, x1 + 6, barY + barHeight / 2 - 3);

        ctx.font = '9px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(`Q${slice.queueLevel}`, x1 + 6, barY + barHeight / 2 + 10);
        ctx.restore();
      }
    });

    // 4. Current Time Needle
    const nowX = leftMargin + (currentTime - timeOffset) * pps;
    if (nowX >= leftMargin && nowX <= width) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(nowX, 0);
      ctx.lineTo(nowX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Needle pointer marker
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(nowX - 5, 0);
      ctx.lineTo(nowX + 5, 0);
      ctx.lineTo(nowX, 7);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Draw Tooltip for Hovered Slice
    if (this.hoveredSlice) {
      const slice = this.hoveredSlice;
      const tooltipX = Math.min(width - 160, Math.max(leftMargin + 10, leftMargin + (slice.start - timeOffset) * pps));
      const tooltipY = 40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      this.drawRoundedRect(ctx, tooltipX, tooltipY, 150, 68, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${slice.jobId} (Queue ${slice.queueLevel})`, tooltipX + 8, tooltipY + 16);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText(slice.jobName.length > 18 ? slice.jobName.substring(0, 16) + '...' : slice.jobName, tooltipX + 8, tooltipY + 32);
      ctx.fillText(`Time: ${slice.start.toFixed(1)}s - ${slice.end.toFixed(1)}s`, tooltipX + 8, tooltipY + 47);
      ctx.fillText(`Pages in slice: ${slice.pagesPrinted || 1}`, tooltipX + 8, tooltipY + 60);
    }
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  // Exports completed jobs table to CSV
  exportToCSV() {
    const jobs = this.scheduler.completedJobs;
    if (jobs.length === 0) {
      alert('No completed jobs to export yet!');
      return;
    }

    const headers = [
      'Job ID',
      'Document Name',
      'User',
      'Total Pages',
      'Initial Queue',
      'Final Queue',
      'Color Mode',
      'Arrival Time (s)',
      'Start Time (s)',
      'Finish Time (s)',
      'Turnaround Time (s)',
      'Waiting Time (s)',
      'Demotions',
      'Promotions (Aging)'
    ];

    const rows = jobs.map(j => [
      j.id,
      `"${j.name.replace(/"/g, '""')}"`,
      `"${j.user.replace(/"/g, '""')}"`,
      j.totalPages,
      `Q${j.initialQueueLevel}`,
      `Q${j.queueLevel}`,
      j.colorMode.toUpperCase(),
      j.arrivalTime.toFixed(1),
      j.startTime !== null ? j.startTime.toFixed(1) : '-',
      j.finishTime !== null ? j.finishTime.toFixed(1) : '-',
      j.turnaroundTime.toFixed(1),
      j.waitingTime.toFixed(1),
      j.demotionsCount,
      j.promotionsCount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `printer_scheduler_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Exports entire simulation state to JSON
  exportToJSON() {
    const payload = {
      timestamp: new Date().toISOString(),
      config: {
        mode: this.scheduler.mode,
        preemptive: this.scheduler.preemptive,
        agingEnabled: this.scheduler.agingEnabled,
        agingThreshold: this.scheduler.agingThreshold,
        quantumQ1: this.scheduler.quantumQ1,
        quantumQ2: this.scheduler.quantumQ2
      },
      metrics: this.scheduler.getMetrics(),
      completedJobs: this.scheduler.completedJobs,
      ganttHistory: this.scheduler.ganttHistory
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `printer_scheduler_session_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

window.AnalyticsManager = AnalyticsManager;
