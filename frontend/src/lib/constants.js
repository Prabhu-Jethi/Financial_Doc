/**
 * Application Constants
 * Curated SEC 10-K corporate tickers, analyst roles, and terminal configurations.
 */

export const FINANCIAL_ROLES = [
  "Equity Research",
  "Investment Banking",
  "Corporate Finance",
  "Private Equity",
  "Risk & Compliance",
  "Individual Investor",
];

export const CURATED_COMPANIES = [
  { ticker: "AAPL", name: "Apple Inc.", years: [2024, 2023, 2022] },
  { ticker: "MSFT", name: "Microsoft Corporation", years: [2024, 2023, 2022] },
  { ticker: "AMZN", name: "Amazon.com, Inc.", years: [2025, 2024, 2023] },
  { ticker: "META", name: "Meta Platforms, Inc.", years: [2024, 2023] },
];

export const DEFAULT_TICKERS = ["AAPL", "MSFT", "AMZN", "META"];

export const REPORT_TYPES = ["10-K", "10-Q", "8-K"];

export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};

export const STORAGE_KEYS = {
  THEME: "docintel_theme",
  RECENT_QUERIES: "docintel_recent_queries",
};

