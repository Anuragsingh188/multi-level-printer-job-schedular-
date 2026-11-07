# 📖 User Manual & Simulation Walkthroughs

Welcome to the **Multi-Level Printer Job Scheduler (PrintPulse MLFQ)** user manual. This guide explains how to interact with the website, run pre-built simulation scenarios, and interpret operating system metrics.

---

## 🖥️ Screen Layout & Component Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP HEADER: Sim Clock | Pause/Play | Step 1s | Speed | Audio | Config   │
├────────────────────────────────────────────────────────────────────────┤
│ SCENARIO PRESETS: [⚡ Burst] [🐘 Elephant] [⏳ Starvation] [🏫 Campus]  │
├──────────────────────────────────────┬─────────────────────────────────┤
│ MULTI-LEVEL QUEUES                   │ PRINTER HARDWARE STATION        │
│ 🔴 Queue 1: Urgent (RR, Q=2)         │ - LaserJet Graphic (Paper Feed) │
│ 🟡 Queue 2: Standard (RR, Q=4)       │ - Active Job Details & Progress │
│ 🟢 Queue 3: Batch (FCFS)             │ - Paper & Toner Consumables     │
│                                      │ - Submit New Job Form           │
├──────────────────────────────────────┴─────────────────────────────────┤
│ LIVE GANTT CHART: Real-time Canvas Execution Timeline                  │
├────────────────────────────────────────────────────────────────────────┤
│ PERFORMANCE METRICS: Avg TAT | Avg WT | Max WT | Throughput | Duty %   │
├────────────────────────────────────────────────────────────────────────┤
│ COMPLETED JOBS TABLE & DIAGNOSTICS: [Export CSV] [Export JSON]         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🎮 Navigation & Controls

### 1. Simulation Playback Controls
- **Play / Pause** (`Spacebar`): Toggles the real-time simulation clock on and off.
- **Step 1s** (`S` key): Advances the simulation clock by exactly 1.0 second. Ideal for studying context switches and queue demotions step by step.
- **Speed Selector**: Run the simulation at $0.5\times$, $1.0\times$ (normal), $2.0\times$ (fast), $4.0\times$ (hyper), or $8.0\times$ (maximum speed).
- **Audio On / Mute**: Toggles procedural sound effects generated via Web Audio API (stepper motor scanning, paper feeding roller sounds, completion chime).
- **Reset** (`R` key): Empties all active queues, clears completed history, and resets the simulation clock to zero.

### 2. Multi-Level Queue Swimlanes
Each job card in the queue displays:
- **Job ID & Document Title**: e.g. `#JOB-104 - Medical_Scan.pdf`
- **User & Page Count**: e.g. `User: Dr. Evelyn | 2 / 5 pgs`
- **Wait Timer**: Tracks accumulated waiting time in seconds.
- **Aging Countdown**: Displays seconds remaining until anti-starvation promotion.
- **Card Controls**:
  - `✕`: Cancel and remove job from queue.
  - `▲`: Manually promote job to higher priority queue.
  - `▼`: Manually demote job to lower priority queue.

### 3. Printer Hardware Station
- **Physical Animation**: Realistic SVG animation depicting sheets entering from the top tray, passing under the scanner printhead, and dropping into the output bin.
- **LED Indicators**:
  - 🟢 **Solid Green**: Ready / Idle.
  - 🔵 **Pulsing Blue**: Actively printing.
  - 🟡 **Yellow**: Paused.
  - 🔴 **Flashing Red**: Out of paper or toner.
- **Consumables Management**:
  - **Paper Tray**: 100 sheets capacity. Decrements by 1 per page. Click **Refill** to restock.
  - **Toner Cartridge**: Decrements by $0.4\%$ for full color and $0.2\%$ for black & white. Click **Replace** to restore to $100\%$.

---

## 🧪 Interactive Scenario Walkthroughs

Click the preset buttons in the sub-header bar to observe specific operating system phenomena:

### Scenario 1: ⚡ Express Burst
- **What happens**: 4 urgent, short print jobs (1 to 3 pages each) arrive at Queue 1 simultaneously.
- **Observation**:
  - Watch the scheduler execute them using Round Robin with a quantum of $Q_1 = 2\text{ pages}$.
  - Notice that 1-page and 2-page documents complete in their very first quantum slice, achieving very low Turnaround Time (TAT).

### Scenario 2: 🐘 Elephant & Mice (Preemption Demo)
- **What happens**:
  1. A huge 24-page batch archive job (`Huge_Annual_Archive_Report_2026.pdf`) starts in Queue 3.
  2. A few seconds later, urgent 1-page and 2-page boarding passes arrive in Queue 1.
- **Observation**:
  - The printer immediately halts the batch job (Preemption).
  - The batch job is placed at the front of its queue with its remaining pages intact.
  - The urgent jobs are processed right away.
  - As soon as Queue 1 and Queue 2 are empty, the printer resumes the batch job right where it left off!

### Scenario 3: ⏳ Starvation & Aging Demo
- **What happens**:
  - A low-priority batch job enters Queue 3.
  - Several higher-priority jobs arrive in Queue 2.
- **Observation**:
  - Without aging, the batch job would starve.
  - Watch the `🔥 Aging: Xs` countdown on the Queue 3 card.
  - When the countdown hits zero ($8\text{ seconds}$ in this preset), a celebratory chime plays and the job is automatically **promoted** to Queue 2, and eventually to Queue 1 if starvation continues!

### Scenario 4: 🏫 Campus Print Lab Workload
- **What happens**:
  - Simulates a busy university computer lab with a realistic mix of student essays, faculty exams, thesis drafts, and event flyers.
- **Observation**:
  - Demonstrates long-term steady-state metrics: Hardware Utilization near $100\%$, balanced average waiting times, and Gantt chart interleaving.

---

## 📝 Submitting Custom Print Jobs

To submit custom jobs:
1. Enter the **Document Name** (or click **🎲 Random Job** for instant generation).
2. Specify the **Total Pages** (1 to 100).
3. Select the **Target Queue**:
   - `Queue 1: Urgent (VIP)`
   - `Queue 2: Standard (Normal)`
   - `Queue 3: Batch (Background)`
4. Choose **Print Mode**: *Full Color* or *Black & White*.
5. Enter **User / Department** name.
6. Click **➕ Send to Printer Queue**.

---

## ⚙️ Configuring Algorithm Settings

Click the **⚙️ Settings** button in the top navigation bar to open the configuration dialog:

| Setting | Options | Description |
| :--- | :--- | :--- |
| **Scheduling Architecture** | `MLFQ` or `MLQ` | MLFQ enables quantum demotions and aging. MLQ enforces static priorities. |
| **Preemption** | On / Off (Checkbox) | When On, higher queue arrivals interrupt running lower queue jobs. |
| **Anti-Starvation Aging** | On / Off (Checkbox) | Automatically elevates long-waiting jobs to higher queues. |
| **Aging Threshold** | 4 to 60 seconds | Waiting duration required before promotion triggers. |
| **Queue 1 Quantum** | 1 to 10 pages | Slice duration before demotion from Queue 1. |
| **Queue 2 Quantum** | 1 to 20 pages | Slice duration before demotion from Queue 2. |

---

## 📊 Exporting Reports

Click **📥 Export CSV** or **📄 Export JSON** above the completion table to download full session logs for lab reports, academic assignments, or spreadsheet analysis.

