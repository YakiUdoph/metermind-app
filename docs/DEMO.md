# Developer Demo Walkthrough Guide

MeterMind features an interactive developer dashboard that visualizes the entire procurement lifecycle. Follow this guide to run the demo locally.

---

## 1. Setting Up the Environment

1.  **Clone the Repository** and install dependencies:
    ```bash
    npm install
    ```
2.  **Duplicate the Environment File**:
    ```bash
    copy .env.example .env
    ```
3.  **Start the Local Server**:
    ```bash
    npm run dev
    ```
4.  **Open the Browser** to: `http://localhost:3000/run-task`

---

## 2. Interactive Demo Flows

The dashboard under `/run-task` supports two operational modes:

### Flow A: Simple Procurement Mode (Default Mock catalog)
*   Uses a static list of 4 search and research mock providers.
*   Allows toggling optimization priorities (`Balanced`, `Lowest Cost`, `Highest Quality`, `Fastest`).
*   Demonstrates the deterministic ranking calculations in real-time.

### Flow B: Full Planning Mode (Multi-stage pipelines)
1.  **Submit Intent**: Type a compound request, e.g., *"Research today's AI market news and summarize it into English"* with a budget of `$2.00`.
2.  **Budget Partitioning**: The engine detects three separate required stages (`web_search`, `content_extraction`, and `summarization`) and partitions the budget accordingly.
3.  **Qualification & Winner Selection**:
    *   Excludes providers exceeding the partition budget.
    *   Finds the highest-scoring candidate for each stage.
4.  **Buy Contract signing**:
    *   A preview shows the frozen contract containing provider details, quoted price, destination address, and token currency.
    *   Clicking **Pay and Execute** triggers the wallet signature check.
5.  **Execution & Delivery Verification**:
    *   If running in `simulation` mode, it initiates a simulated 402 challenge loop and displays the settled transaction hash (starting with `sim_tx_`).
    *   The payload is verified by checking the output format and keywords before outputting the final receipt.
