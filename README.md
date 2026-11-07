# 🖨️ Multi-Level Printer Job Scheduler (PrintPulse MLFQ)

An interactive, responsive, and educational web application that simulates a **Multi-Level Queue (MLQ)** and **Multi-Level Feedback Queue (MLFQ)** printer job scheduling system.

Designed for Computer Science students, Operating Systems engineers, and educators to visualize how modern CPU and device spooling schedulers prevent starvation, handle preemption, and balance high-priority express tasks against long batch workloads.

---

## 🌟 Key Features

- **Multi-Level Queue Architecture (3 Priority Levels)**:
  - **Queue 1 (Urgent / VIP)**: Highest priority. Scheduled with **Round Robin** ($Q_1 = 2\text{ pages}$). Designed for quick slips, boarding passes, medical emergency reports.
  - **Queue 2 (Standard / Normal)**: Medium priority. Scheduled with **Round Robin** ($Q_2 = 4\text{ pages}$). Designed for regular multi-page student/office documents.
  - **Queue 3 (Batch / Background)**: Lowest priority. Scheduled with **First-Come, First-Served (FCFS)**. Runs to completion unless preempted. Designed for massive archives, manuals, and books.
- **Adaptive Feedback Queue (MLFQ)**:
  - **Quantum Demotion**: Long jobs in Queue 1 that exceed their time quantum are demoted to Queue 2, and from Queue 2 down to Queue 3.
  - **Anti-Starvation Aging**: Jobs waiting in Queue 3 or Queue 2 for longer than the configurable threshold (default: 12 seconds) are automatically **promoted** to a higher priority queue.
- **Preemptive & Non-Preemptive Modes**:
  - Higher-priority arrivals can instantly preempt running lower-priority jobs, placing the interrupted job at the front of its queue so it can resume promptly.
- **Live Gantt Chart Visualization**:
  - Real-time HTML5 Canvas timeline depicting exact printer time slices color-coded by Job ID and Queue Level.
  - Interactive hover tooltips and zoom controls ($0.5\times$, $1\times$, $2\times$).
- **Realistic Printer Hardware Simulation**:
  - Animated SVG printer with mechanical paper feeding, laser head scanning, and output tray stacking.
  - Consumables monitoring: **Paper Tray (Sheets)** and **Toner Cartridge (%)** with one-click refill/replace.
  - Web Audio API synthesizer for realistic stepper motor and paper roller acoustics (toggleable mute/unmute).
- **Comprehensive OS Metrics & Diagnostics**:
  - Average Turnaround Time ($\text{TAT} = \text{Finish Time} - \text{Arrival Time}$)
  - Average Waiting Time ($\text{WT} = \text{TAT} - \text{Burst Time}$)
  - Peak / Maximum Waiting Time (starvation diagnostic)
  - Throughput (Jobs / minute)
  - Hardware Utilization (%)
- **Data Export**:
  - One-click export of complete execution logs to **CSV** and **JSON**.
- **Interactive Scenarios**:
  - ⚡ *Express Burst*
  - 🐘 *Elephant & Mice (Preemption)*
  - ⏳ *Starvation & Aging Demonstration*
  - 🏫 *Campus Print Lab Workload*

---

## 📁 Project Structure

```
asmit/
├── index.html              # Main single-page application entry point
├── server.js               # Lightweight zero-dependency native Node.js HTTP server
├── package.json            # Project manifest & npm start script
├── README.md               # Main project documentation & overview
├── ALGORITHMS_GUIDE.md     # Deep dive into MLQ/MLFQ operating system theory
├── USER_MANUAL.md          # Step-by-step user manual & scenario walkthroughs
├── css/
│   └── style.css           # Modern dark-theme glassmorphism styling & animations
└── js/
    ├── scheduler.js        # Core MLQ & MLFQ scheduling logic & job state machine
    ├── printer.js          # Hardware simulator (rollers, paper feed, consumables)
    ├── analytics.js        # Real-time Gantt canvas renderer & telemetry exports
    ├── audio.js            # Web Audio API procedural sound synthesizer
    └── app.js              # Application controller, DOM sync, and presets
```

---

## 🚀 Quick Start (Two Ways to Run)

### Method 1: Instant Browser Launch (Zero Installation)
Simply double-click or open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Brave, Safari):
```bash
# In Windows PowerShell:
Start-Process index.html
```

### Method 2: Via Built-In Node.js Server
If you have Node.js installed, run the lightweight zero-dependency server:
```bash
npm start
# or:
node server.js
```
Then open your browser at:
```
http://localhost:3000
```

---

## 🧠 Scheduling Theory & Formulas

| Metric | Formula | Definition |
| :--- | :--- | :--- |
| **Turnaround Time (TAT)** | $\text{TAT} = T_{\text{finish}} - T_{\text{arrival}}$ | Total time elapsed from submission to final sheet output. |
| **Waiting Time (WT)** | $\text{WT} = \text{TAT} - T_{\text{execution}}$ | Total time the job spent waiting in ready queues. |
| **Throughput** | $\frac{\text{Completed Jobs}}{\text{Total Simulation Time}} \times 60$ | Number of jobs finished per minute. |
| **Printer Utilization** | $\frac{\text{Busy Time}}{\text{Total Elapsed Time}} \times 100\%$ | Percentage of time the printer was actively printing. |

---

## 🛠️ Configuration Options

Open the **⚙️ Settings** modal in the top navigation bar to tweak:
1. **Architecture Mode**: Switch between *Multi-Level Feedback Queue (Adaptive MLFQ)* and *Fixed Multi-Level Queue (Static Priority MLQ)*.
2. **Preemption**: Toggle whether arriving high-priority jobs interrupt active lower-priority jobs.
3. **Anti-Starvation Aging**: Enable or disable dynamic promotion.
4. **Aging Threshold**: Set waiting duration (4s to 60s) before promotion occurs.
5. **Time Quanta**: Modify $Q_1$ (pages for Queue 1) and $Q_2$ (pages for Queue 2).

---

## 📚 Related Documentation

- For in-depth scheduling theory, state charts, and mathematical proofs, read [ALGORITHMS_GUIDE.md](ALGORITHMS_GUIDE.md).
- For scenario guides, presets, and keyboard shortcuts, read [USER_MANUAL.md](USER_MANUAL.md).

---

## 📄 License

This project is licensed under the MIT License.

