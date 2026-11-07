# 📐 Operating System Algorithms & Theory Guide

This document provides a comprehensive theoretical and technical analysis of the scheduling algorithms implemented in the **Multi-Level Printer Job Scheduler**.

---

## 1. Background: The Device Spooling Problem

In operating systems, a printer is a **non-shareable, sequential resource**. Unlike a CPU that can switch contexts in microseconds, mechanical devices like printers possess mechanical inertia (paper feeder, heating fuser, printhead motor). 

Operating systems use **spooling** (Simultaneous Peripheral Operations On-Line) to buffer print requests into queues rather than forcing applications to block until printing finishes. When multiple jobs arrive from different users (VIP administrators, students, background logging daemons), a scheduling policy is required to govern the execution order.

---

## 2. Multi-Level Queue (MLQ) vs. Multi-Level Feedback Queue (MLFQ)

### Fixed Multi-Level Queue (MLQ)
In a static MLQ scheduler:
- The system maintains several queues with strictly differentiated priorities.
- Jobs are statically assigned to a specific queue upon creation (e.g., based on document category or user role).
- **No movement**: Once placed in a queue, a job remains in that queue forever until completion.
- **Starvation risk**: If high-priority queues are continuously fed with new jobs, lower-priority queues will experience indefinite postponement (starvation).

### Multi-Level Feedback Queue (MLFQ)
Developed by Fernando J. Corbató (1962), MLFQ introduces **dynamic priority adaptation**:
- Jobs can **move between queues** based on their behavioral characteristics and waiting history.
- Long jobs that consume excessive hardware resources are **demoted** to lower-priority queues to keep high-priority queues reserved for short, interactive tasks.
- Starving jobs that have languished in low-priority queues for too long are **promoted** via an **Aging mechanism**, ensuring bounded maximum waiting time.

---

## 3. The 3-Tier Queue Hierarchy

Our implementation utilizes a 3-tier hierarchy:

```
[ New Job Arrival ]
        │
        ▼
┌────────────────────────────────────────┐
│  Queue 1: Urgent / VIP                 │
│  - Algorithm: Round Robin              │
│  - Time Quantum: Q1 = 2 pages          │
└──────────────────┬─────────────────────┘
                   │ Exceeds Q1 (Demotion)
                   ▼
┌────────────────────────────────────────┐
│  Queue 2: Standard / Normal            │  ▲ Aging Promotion
│  - Algorithm: Round Robin              │  │ (waited > threshold)
│  - Time Quantum: Q2 = 4 pages          │──┘
└──────────────────┬─────────────────────┘
                   │ Exceeds Q2 (Demotion)
                   ▼
┌────────────────────────────────────────┐
│  Queue 3: Batch / Background           │  ▲ Aging Promotion
│  - Algorithm: FCFS (First-Come First-  │  │ (waited > threshold)
│               Served)                  │──┘
└────────────────────────────────────────┘
```

### Queue 1: Urgent / Express VIP
- **Algorithm**: Round Robin (RR) with a small quantum ($Q_1 = 2\text{ pages}$).
- **Goal**: Minimize response time for small documents (tickets, boarding passes, prescriptions).
- **Behavior**: If a job finishes within 2 pages, it completes rapidly with minimal turnaround time. If it requires more than 2 pages, it yields the printer and is demoted to Queue 2.

### Queue 2: Standard / Normal
- **Algorithm**: Round Robin (RR) with a larger quantum ($Q_2 = 4\text{ pages}$).
- **Goal**: Balance throughput and turnaround time for moderate-length documents (essays, reports).
- **Behavior**: Jobs receive 4 pages of execution. If they still require additional pages, they are demoted to Queue 3.

### Queue 3: Batch / Bulk
- **Algorithm**: First-Come, First-Served (FCFS).
- **Goal**: Maximize continuous printer mechanical throughput for large documents (manuals, logs, books).
- **Behavior**: Runs continuously until completion, unless preempted by higher-priority arrivals.

---

## 4. Preemption and Context Switching

### Preemptive vs. Non-Preemptive
- **Non-Preemptive**: When a job starts printing its time quantum slice, it cannot be interrupted until the slice finishes.
- **Preemptive (Default in this simulator)**:
  - If a job is currently printing in Queue 2 or Queue 3, and a new job arrives in Queue 1:
  1. The running job is immediately halted.
  2. The remaining pages of the running job are saved.
  3. The interrupted job is placed at the **head** (index 0) of its respective queue so it retains priority when resumed.
  4. The newly arrived Queue 1 job seizes the printer immediately.

---

## 5. Starvation & The Aging Mechanism

### The Starvation Hazard
Consider a scenario where:
1. Job A (100-page batch document) enters Queue 3.
2. Every 3 seconds, a new 1-page document enters Queue 1.
3. Without intervention, Job A will **never** print. Its waiting time will grow toward infinity:
   $$\lim_{t \to \infty} \text{WT}(\text{Job A}) = \infty$$

### The Solution: Aging
To enforce fairness, the scheduler monitors the parameter:
$$\text{timeInCurrentQueue}$$

Whenever:
$$\text{timeInCurrentQueue} \ge \text{Aging Threshold} \quad (\text{e.g., } 12\text{ seconds})$$

The scheduler automatically performs:
1. Removal from current queue (e.g. Queue 3).
2. Promotion to next higher queue (Queue 2).
3. Reset of `timeInCurrentQueue = 0`.
4. Increments `job.promotionsCount`.
5. Visual notification and auditory chime to signal the anti-starvation event.

---

## 6. Mathematical Evaluation & Metrics

The simulator logs all timestamps in discrete simulation seconds ($t$).

### Turnaround Time (TAT)
$$\text{TAT}_i = T_{\text{finish}, i} - T_{\text{arrival}, i}$$
The total lifespan of Job $i$ from user submission to final sheet ejection.

### Waiting Time (WT)
$$\text{WT}_i = \text{TAT}_i - T_{\text{burst}, i}$$
The duration spent in queues waiting for printer hardware availability.

### Hardware Utilization
$$\text{Utilization} = \frac{\sum_{i} T_{\text{burst}, i}}{T_{\text{total}}} \times 100\%$$

### Throughput
$$\text{Throughput} = \frac{N_{\text{completed}}}{T_{\text{total}}} \times 60 \quad (\text{jobs per minute})$$

---

## 7. Comparison Summary Matrix

| Metric / Dimension | FCFS | Round Robin (RR) | Fixed Priority (MLQ) | Adaptive MLFQ |
| :--- | :--- | :--- | :--- | :--- |
| **Response Time for Short Jobs** | Poor (Convoy effect) | Good | Excellent (if in top queue) | **Optimal** |
| **Starvation Potential** | None | None | High (for lower queues) | **None (via Aging)** |
| **Overhead** | Minimum | Low | Moderate | Moderate |
| **Adaptability** | None | None | Static | **Dynamic & Self-Tuning** |

