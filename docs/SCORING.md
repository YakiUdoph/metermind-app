# Procurement Scoring & Ranking Algorithm

MeterMind utilizes a deterministic utility selection logic inside [`scoring.ts`](file:///c:/Users/PC/Desktop/METERMIND/metermind-app/src/domain/procurement/scoring.ts) to filter, scale, and rank candidate service providers.

---

## 1. Priority Weights
 
The selection algorithm supports five distinct optimization priorities, which map to specific weight allocations across price, quality, reliability, and latency:
 
| Priority | Price Weight | Quality Weight | Reliability Weight | Latency Weight |
| :--- | :---: | :---: | :---: | :---: |
| **`balanced`** | 20% (`0.20`) | 45% (`0.45`) | 25% (`0.25`) | 10% (`0.10`) |
| **`lowest-cost`** / **`cheapest`** | 75% (`0.75`) | 10% (`0.10`) | 10% (`0.10`) | 5% (`0.05`) |
| **`highest-quality`**| 0% (`0.00`) | 70% (`0.70`) | 30% (`0.30`) | 0% (`0.00`) |
| **`fastest`** | 5% (`0.05`) | 10% (`0.10`) | 20% (`0.20`) | 65% (`0.65`) |
| **`most-reliable`** | 5% (`0.05`) | 10% (`0.10`) | 80% (`0.80`) | 5% (`0.05`) |
 
---
 
## 2. Min-Max Normalization
 
To aggregate disparate units (USD, scores out of 100, percentages, and milliseconds), metrics are normalized to a `[0, 100]` scale relative only to the *active qualified candidate set*:
 
### Price Score Calculation
The cheapest provider receives a score of 100, and the most expensive receives 0.
$$\text{Price Score} = \frac{\text{Max Price} - \text{Provider Price}}{\text{Max Price} - \text{Min Price}} \times 100$$
*(If all qualified candidates have the same price, the Price Score defaults to 100).*
 
### Latency Score Calculation
The fastest provider (lowest latency) receives a score of 100, and the slowest receives 0.
$$\text{Latency Score} = \frac{\text{Max Latency} - \text{Provider Latency}}{\text{Max Latency} - \text{Min Latency}} \times 100$$
*(If all qualified candidates have the same latency, the Latency Score defaults to 100).*
 
### Quality and Reliability
These metrics are already expressed on a `[0, 100]` scale and do not require dynamic normalization.
 
---
 
## 3. Preferred Provider Bonus
 
If a provider is designated as a preferred provider in the task request constraints, it receives a soft score bonus of **+3 points** added to its base weighted score:
$$\text{Total Score} = \text{Base Weighted Score} + 3$$
This soft bonus allows preferred providers to win close ties while preventing poor-performing providers from winning if they are significantly worse.
 
---
 
## 4. Pareto Optimal Candidate Selection
 
Before scoring, MeterMind identifies the **Pareto Frontier** of all eligible candidates.
*   **Domination**: A candidate provider B is dominated by candidate provider A if A is no worse than B in all four dimensions (price, latency, quality, reliability) and strictly better than B in at least one dimension.
*   **Frontier**: Candidates that are not dominated by any other provider form the Pareto frontier.
*   **Decision Impact**: While all eligible candidates are scored, dominated candidates are marked as non-Pareto optimal in the decision trace. This helps AI agents and audit logs highlight suboptimal selections and confirm the economic rationality of the choice.
 
---
 
## 5. 6-Stage Deterministic Tie-Breaker
 
To guarantee deterministic, auditable decisions across runtimes, equal total scores are broken sequentially using the following 6 rules:
 
1.  **Total Score**: Select the highest total score (including preferred bonus).
2.  **Reliability**: Select the highest historical reliability metric.
3.  **Quality**: Select the highest historical quality score.
4.  **Price**: Select the lowest quoted price (USD).
5.  **Latency**: Select the lowest latency (milliseconds).
6.  **Provider ID**: Lexicographical string comparison of the provider ID (e.g. `p1` vs `p2`).
