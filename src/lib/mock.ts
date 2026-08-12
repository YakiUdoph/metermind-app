// Mock data layer for MeterMind.
// Shaped like an API response so it can be swapped for real fetches later.

export type Decision = "APPROVED" | "BLOCKED" | "ROUTED" | "PENDING";

export interface Transaction {
  id: string;
  agent: string;
  provider: string;
  amount: number;
  originalAmount?: number;
  saved?: number;
  decision: Decision;
  reason: string[];
  category: string;
  timestamp: string;
}

export interface Agent {
  id: string;
  name: string;
  status: "Active" | "Paused";
  budget: number;
  spent: number;
  saved: number;
  rules: { label: string; value: string }[];
}

export const metrics = {
  totalManaged: 24820.4,
  spentThisMonth: 8412.19,
  savedByMeterMind: 1284.62,
  activeAgents: 12,
};

export const spendOverTime = [
  { day: "Jul 14", spend: 214, saved: 22 },
  { day: "Jul 16", spend: 268, saved: 31 },
  { day: "Jul 18", spend: 191, saved: 18 },
  { day: "Jul 20", spend: 342, saved: 47 },
  { day: "Jul 22", spend: 298, saved: 38 },
  { day: "Jul 24", spend: 388, saved: 61 },
  { day: "Jul 26", spend: 312, saved: 44 },
  { day: "Jul 28", spend: 431, saved: 72 },
  { day: "Jul 30", spend: 396, saved: 58 },
  { day: "Aug 01", spend: 468, saved: 81 },
  { day: "Aug 03", spend: 402, saved: 64 },
  { day: "Aug 05", spend: 521, saved: 96 },
];

export const spendByService = [
  { name: "OpenAI", amount: 3218.44 },
  { name: "Anthropic", amount: 2104.9 },
  { name: "Google", amount: 1188.32 },
  { name: "AWS", amount: 942.18 },
  { name: "ElevenLabs", amount: 618.05 },
  { name: "Other", amount: 340.3 },
];

export const transactions: Transaction[] = [
  {
    id: "MM-2841",
    agent: "Research Agent",
    provider: "OpenAI",
    amount: 21.8,
    originalAmount: 25.4,
    saved: 3.6,
    decision: "APPROVED",
    reason: [
      "Within remaining budget",
      "Provider is approved",
      "Under transaction maximum",
      "No suspicious spending pattern detected",
    ],
    category: "AI inference",
    timestamp: "Just now",
  },
  {
    id: "MM-2840",
    agent: "Research Agent",
    provider: "OpenAI",
    amount: 18.2,
    saved: 2.1,
    decision: "APPROVED",
    reason: ["Within monthly agent budget", "Under $50 transaction limit"],
    category: "AI inference",
    timestamp: "2 min ago",
  },
  {
    id: "MM-2839",
    agent: "Marketing Agent",
    provider: "ElevenLabs",
    amount: 94.0,
    decision: "BLOCKED",
    reason: ["Transaction exceeds $50 limit", "Requires human override"],
    category: "Voice synthesis",
    timestamp: "6 min ago",
  },
  {
    id: "MM-2838",
    agent: "Coding Agent",
    provider: "Anthropic",
    amount: 7.84,
    saved: 0.94,
    decision: "APPROVED",
    reason: ["Within monthly agent budget", "Lower-cost route selected"],
    category: "Code generation",
    timestamp: "11 min ago",
  },
  {
    id: "MM-2837",
    agent: "Data Agent",
    provider: "AWS",
    amount: 32.1,
    originalAmount: 38.6,
    saved: 6.5,
    decision: "ROUTED",
    reason: ["Cheaper regional route available", "Provider is approved"],
    category: "Compute",
    timestamp: "18 min ago",
  },
  {
    id: "MM-2836",
    agent: "Research Agent",
    provider: "Google",
    amount: 4.12,
    decision: "APPROVED",
    reason: ["Within monthly agent budget", "Under $50 transaction limit"],
    category: "Search grounding",
    timestamp: "27 min ago",
  },
  {
    id: "MM-2835",
    agent: "Support Agent",
    provider: "OpenAI",
    amount: 61.5,
    decision: "BLOCKED",
    reason: ["Transaction exceeds $50 limit", "Duplicate request within 60s"],
    category: "AI inference",
    timestamp: "34 min ago",
  },
];

export const agents: Agent[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    status: "Active",
    budget: 1000,
    spent: 438.22,
    saved: 87.41,
    rules: [
      { label: "Maximum transaction", value: "$50" },
      { label: "Approved services", value: "OpenAI, Anthropic, Google" },
      { label: "Auto-pay", value: "Enabled" },
      { label: "Optimization", value: "Lowest reasonable cost" },
    ],
  },
  {
    id: "coding-agent",
    name: "Coding Agent",
    status: "Active",
    budget: 750,
    spent: 302.66,
    saved: 51.18,
    rules: [
      { label: "Maximum transaction", value: "$40" },
      { label: "Approved services", value: "Anthropic, OpenAI" },
      { label: "Auto-pay", value: "Enabled" },
      { label: "Optimization", value: "Prefer cached completions" },
    ],
  },
  {
    id: "marketing-agent",
    name: "Marketing Agent",
    status: "Paused",
    budget: 500,
    spent: 214.9,
    saved: 22.04,
    rules: [
      { label: "Maximum transaction", value: "$50" },
      { label: "Approved services", value: "ElevenLabs, OpenAI" },
      { label: "Auto-pay", value: "Requires review" },
      { label: "Optimization", value: "Lowest reasonable cost" },
    ],
  },
  {
    id: "data-agent",
    name: "Data Agent",
    status: "Active",
    budget: 1200,
    spent: 688.4,
    saved: 143.22,
    rules: [
      { label: "Maximum transaction", value: "$120" },
      { label: "Approved services", value: "AWS, Google" },
      { label: "Auto-pay", value: "Enabled" },
      { label: "Optimization", value: "Cheapest region" },
    ],
  },
];

export const savingsInsights = [
  { label: "API provider optimization", value: 420, detail: "Route 38% of inference to a cheaper equivalent model" },
  { label: "Unused agent budget", value: 310, detail: "3 agents consistently underspend their allocation" },
  { label: "Duplicate service usage", value: 184, detail: "Two agents pay for overlapping search APIs" },
  { label: "Expensive routing", value: 370, detail: "Cross-region compute billed at premium rates" },
];

export const currency = (n: number, decimals = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
