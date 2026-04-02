# 🛡️ Psych-Sentinel v1.0 | Cognitive SOAR & Reasoning Engine

**Architect:** Raihan Hanif Firdaus
**Stack:** Vanilla JS, Tailwind CSS, Google AntiGravity, Gemini 1.5 Flash, Turso DB

---

## 🌐 Executive Summary
Psych-Sentinel is a **Cyber-Psychology SIEM (Security Information and Event Management)** designed to treat intrusive thoughts and cognitive distortions as actionable security incidents. By applying professional SOC (Security Operations Center) logic to mental health, the system parses raw "log dumps" into structured JSON, identifies threat actors (e.g., *The Imposter*), and triggers automated **SOAR Playbooks** for immediate remediation.

---

## 🚀 Core Features

### 1. AI Reasoning Engine (Gemini 1.5 Flash)
The heart of the system is an agentic pipeline that transforms "Obfuscated Attacks" (negative thoughts) into "Parsed Reality."
* **Logic:** Uses an LLM-driven reasoning engine to map inputs to a **Cognitive TTP Matrix**.
* **Optimization:** Pivoted from Pro to **Flash** to reduce "Reasoning Engine Timeouts" and ensure low-latency incident response.
* **Safety Filter:** Implemented a regex-based sanitization layer to bypass the AI and trigger **Hardcoded Crisis SOPs** for high-risk strings.

### 2. Cognitive TTP Matrix (Tactics, Techniques, & Procedures)
Threats are categorized based on industry-standard forensic logic:
* **Success-Drop Filter (TTP-001):** The innate dropping of `SUCCESS` logs while alerting only on `ERRORS`.
* **Identity Spoofing (TTP-002):** Unauthorized actors (depression) masquerading as the "System Admin."
* **Catastrophizing (TTP-003):** Escalating low-severity events to `CRITICAL` status without data validation.

### 3. Automated Remediation (SOAR Playbooks)
When a threat is detected, the system deploys a **Standard Operating Procedure (SOP)**:
* **Isolation:** 15-minute host disconnect from screens.
* **Recalibration:** Forced viewing of the "Success-to-Error" ratio chart.
* **Manual Commit:** Requirement to log one "Technical Win" to close a High-Severity ticket.

---

## 🛠️ Infrastructure & Persistence
* **Database:** **Turso (SQLite)** handles global persistence, ensuring that "Recovery Logs" are hydrated upon dashboard initialization.
* **Physics Engine:** Powered by **Google AntiGravity**. Older logs utilize a decay function ($$Log\_Decay = Initial\_Severity \times e^{-\lambda t}$$) to physically sink to the bottom of the UI, visualizing the "fading" of past threats.
* **Security:** All external assets (Chart.js) are loaded via CDN with **Subresource Integrity (SRI)** hashes to prevent supply-chain vulnerabilities.

---

## 📝 Incident Log (DevSecOps Audit)

| Date | Incident ID | Description | Resolution |
| :--- | :--- | :--- | :--- |
| 2026-04-02 | ERR-404-AI | Reasoning Engine timeout/404. | Migrated to `models/gemini-1.5-flash` for high-concurrency stability. |
| 2026-04-02 | DB-HYDRATE-01 | Turso logs not observed in session. | Audited async hydration logic; ensured `SELECT` query awaits connection. |

---

## 📈 Business Value
As a **Digital Business** student and aspiring **Security Engineer**, this project demonstrates:
1. **Automation:** The ability to build agentic workflows that solve complex, non-linear problems.
2. **Resilience:** Managing system uptime (and mental uptime) during high-pressure development sprints.
3. **Architecture:** Designing full-stack systems that prioritize data integrity and secure API integration.