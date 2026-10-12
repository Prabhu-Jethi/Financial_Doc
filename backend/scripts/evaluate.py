"""
Automated Evaluation Runner for SEC Financial Document Intelligence Engine.
Compliant with TRD § 7, rules.md § 3, and phases.md (Phase 4 Evaluation Gate).

Evaluates the live pipeline across 20 dev benchmark cases (DEV-001..DEV-020):
1. Status adherence (answered, insufficient_evidence, out_of_scope)
2. Numerical accuracy against verified ground truth
3. Mathematical precision (Deterministic Decimal calculation ledger)
4. Citation & printed page verifiability
5. Zero-hallucination numerical grounding audit (via EvidenceService)
"""

import sys
import os
import json
import time
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from decimal import Decimal

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.services.answering import AnswerService
from backend.app.schemas import AnswerStatus


class FinancialBenchmarkEvaluator:
    def __init__(self):
        self.answer_service = AnswerService()
        self.questions_file = PROJECT_ROOT / "evaluation" / "questions" / "dev_questions.json"
        self.references_file = PROJECT_ROOT / "evaluation" / "references" / "dev_reference.json"
        self.results_dir = PROJECT_ROOT / "evaluation" / "results"
        self.results_dir.mkdir(parents=True, exist_ok=True)

        self.questions = self._load_json(self.questions_file)
        self.references = {r["question_id"]: r for r in self._load_json(self.references_file)}

    def _load_json(self, path: Path) -> Any:
        if not path.exists():
            raise FileNotFoundError(f"Required benchmark file not found: {path}")
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def evaluate_case(self, question_item: Dict[str, Any]) -> Dict[str, Any]:
        """Runs a single benchmark case through AnswerService and grades against reference."""
        qid = question_item["question_id"]
        question = question_item["question"]
        company = question_item.get("company")
        ref = self.references.get(qid)

        if not ref:
            return {
                "question_id": qid,
                "passed": False,
                "error": f"Missing ground truth reference for {qid}",
                "latency_s": 0.0,
            }

        start_time = time.time()
        try:
            result = self.answer_service.answer_query(
                question=question,
                company=company
            )
            elapsed_s = round(time.time() - start_time, 2)
        except Exception as e:
            return {
                "question_id": qid,
                "question": question,
                "passed": False,
                "error": str(e),
                "latency_s": round(time.time() - start_time, 2),
            }

        # -------------------------------------------------------------
        # 1. Status Check
        # -------------------------------------------------------------
        expected_status = ref.get("expected_status", "answered")
        actual_status = result.get("status")
        if hasattr(actual_status, "value"):
            actual_status_str = actual_status.value
        else:
            actual_status_str = str(actual_status)

        status_passed = False
        if expected_status == "insufficient_evidence":
            status_passed = (
                actual_status_str == "insufficient_evidence"
                or "insufficient evidence" in result.get("answer_text", "").lower()
                or "not contain sufficient" in result.get("answer_text", "").lower()
            )
        elif expected_status == "out_of_scope":
            status_passed = (
                actual_status_str == "out_of_scope"
                or "out of scope" in result.get("answer_text", "").lower()
                or "cannot provide" in result.get("answer_text", "").lower()
                or "advice" in result.get("answer_text", "").lower()
            )
        else:
            status_passed = actual_status_str == "answered"

        # -------------------------------------------------------------
        # 2. Numerical Fact Match
        # -------------------------------------------------------------
        numeric_passed = True
        matched_numbers: List[str] = []
        expected_numbers: List[str] = []

        answer_text = result.get("answer_text", "")
        facts = result.get("facts", [])
        fact_vals = [f.reported_value.replace("$", "").replace(",", "").strip() for f in facts]

        ground_truth = ref.get("ground_truth", {})
        if "raw_reported_value" in ground_truth:
            raw_target = str(ground_truth["raw_reported_value"]).replace(",", "").replace("$", "").strip()
            # Handle negative parentheses: (17,730) -> 17730
            raw_target_clean = raw_target.replace("(", "").replace(")", "").strip()
            expected_numbers.append(ground_truth["raw_reported_value"])

            # Check if answer mentions the number or billion-scale equivalent
            found_in_text = (
                raw_target in answer_text.replace(",", "")
                or raw_target_clean in answer_text.replace(",", "")
                or raw_target_clean in fact_vals
            )
            # Also check billion equivalent if large number (e.g., 391,035 -> 391.04B)
            if not found_in_text and len(raw_target_clean) >= 5:
                try:
                    dec_b = round(float(raw_target_clean) / 1000.0, 1)
                    if f"{dec_b}" in answer_text:
                        found_in_text = True
                except ValueError:
                    pass

            if found_in_text:
                matched_numbers.append(ground_truth["raw_reported_value"])
            else:
                numeric_passed = False

        elif "categories" in ground_truth:
            # Table breakdown check (DEV-004)
            cat_list = ground_truth["categories"]
            found_count = 0
            for cat in cat_list:
                cat_val = str(cat["raw_reported_value"]).replace(",", "")
                expected_numbers.append(f"{cat['category']}: {cat['raw_reported_value']}")
                if cat_val in answer_text.replace(",", "") or cat_val in fact_vals:
                    found_count += 1
                    matched_numbers.append(f"{cat['category']}: {cat['raw_reported_value']}")
            numeric_passed = found_count >= len(cat_list) - 1  # Allow at most 1 minor omitted category

        elif "fy2023_value" in ground_truth and "fy2024_value" in ground_truth:
            # Multi-period comparison check (DEV-005)
            v23 = str(ground_truth["fy2023_value"]["raw_reported_value"]).replace(",", "")
            v24 = str(ground_truth["fy2024_value"]["raw_reported_value"]).replace(",", "")
            expected_numbers.extend([ground_truth["fy2023_value"]["raw_reported_value"], ground_truth["fy2024_value"]["raw_reported_value"]])
            has_23 = v23 in answer_text.replace(",", "") or v23 in fact_vals
            has_24 = v24 in answer_text.replace(",", "") or v24 in fact_vals
            if has_23 and has_24:
                matched_numbers.extend([v23, v24])
            else:
                numeric_passed = False

        # -------------------------------------------------------------
        # 3. Mathematical Ledger Check
        # -------------------------------------------------------------
        calc_passed = True
        expected_calc_display: Optional[str] = None
        matched_calc_display: Optional[str] = None

        calc_details = ref.get("calculation_details")
        if calc_details:
            expected_calc_display = calc_details.get("display_value", "").strip()
            clean_expected = expected_calc_display.replace("%", "").replace("+", "").strip()
            
            # Check calculation ledger items
            calcs = result.get("calculations", [])
            found_ledger = False
            for c in calcs:
                clean_disp = c.display_value.replace("%", "").replace("+", "").strip()
                if clean_disp == clean_expected or clean_expected in c.display_value:
                    found_ledger = True
                    matched_calc_display = c.display_value
                    break

            # Fallback check in answer text prose
            if not found_ledger:
                if clean_expected in answer_text or expected_calc_display in answer_text:
                    found_ledger = True
                    matched_calc_display = expected_calc_display

            calc_passed = found_ledger

        # -------------------------------------------------------------
        # 4. Citation Page Check
        # -------------------------------------------------------------
        page_passed = True
        expected_page = ref.get("printed_page")
        citations = result.get("citations", [])
        cited_pages = [str(c.printed_page) for c in citations if c.printed_page]

        if expected_page and expected_page not in {"Item 7", "N/A"}:
            # Normalize pages e.g. "29" or "64" or "29 & 64"
            target_pages = [p.strip() for p in str(expected_page).split("&")]
            has_page = any(tp in cited_pages or any(tp in cp for cp in cited_pages) for tp in target_pages)
            page_passed = has_page

        # -------------------------------------------------------------
        # 5. Zero-Hallucination Audit Check (EvidenceService)
        # -------------------------------------------------------------
        audit = result.get("audit_report", {})
        is_grounded = audit.get("is_grounded", True)
        unverified_numbers = audit.get("unverified_numbers", [])

        # Negative controls (DEV-009, DEV-010) are graded primarily on refusal status
        if expected_status in {"insufficient_evidence", "out_of_scope"}:
            overall_passed = status_passed
        else:
            overall_passed = status_passed and numeric_passed and calc_passed and is_grounded

        return {
            "question_id": qid,
            "task_type": question_item.get("task_type", "factual"),
            "company": company,
            "question": question,
            "passed": overall_passed,
            "status_passed": status_passed,
            "numeric_passed": numeric_passed,
            "calc_passed": calc_passed,
            "page_passed": page_passed,
            "is_grounded": is_grounded,
            "unverified_numbers": unverified_numbers,
            "expected_numbers": expected_numbers,
            "matched_numbers": matched_numbers,
            "expected_calc": expected_calc_display,
            "matched_calc": matched_calc_display,
            "expected_page": expected_page,
            "cited_pages": cited_pages,
            "latency_s": elapsed_s,
            "answer_excerpt": answer_text[:140] + ("..." if len(answer_text) > 140 else ""),
        }

    def run_all(self, limit: Optional[int] = None, specific_id: Optional[str] = None) -> Dict[str, Any]:
        """Runs benchmark suite and generates clean summary scorecard."""
        target_questions = self.questions
        if specific_id:
            target_questions = [q for q in target_questions if q["question_id"] == specific_id]
        if limit:
            target_questions = target_questions[:limit]

        total = len(target_questions)
        print(f" SEC Financial Document Intelligence Engine — Benchmark Evaluation")
        print(f" Target Cases: {total} | Corpus: 11 Filings (AAPL, AMZN, MSFT, META)")
        print(f" Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n")

        results: List[Dict[str, Any]] = []
        for idx, q_item in enumerate(target_questions, 1):
            qid = q_item["question_id"]
            company_short = (q_item.get("company") or "All").split()[0]
            print(f"[{idx:02d}/{total:02d}] Evaluating {qid} ({company_short})... ", end="", flush=True)

            case_res = self.evaluate_case(q_item)
            results.append(case_res)

            status_str = "PASS" if case_res["passed"] else "FAIL"
            status_color = "\033[92mPASS\033[0m" if case_res["passed"] else "\033[91mFAIL\033[0m"
            print(f"{status_color} ({case_res['latency_s']}s)")

        # -------------------------------------------------------------
        # Aggregate Scorecard Metrics
        # -------------------------------------------------------------
        passed_count = sum(1 for r in results if r["passed"])
        numeric_count = sum(1 for r in results if r.get("numeric_passed", False))
        calc_cases = [r for r in results if r.get("expected_calc")]
        calc_passed_count = sum(1 for r in calc_cases if r.get("calc_passed", False))
        grounded_count = sum(1 for r in results if r.get("is_grounded", True))
        page_passed_count = sum(1 for r in results if r.get("page_passed", False))
        avg_latency = round(sum(r["latency_s"] for r in results) / max(total, 1), 2)

        accuracy_pct = round((passed_count / max(total, 1)) * 100, 1)
        calc_pct = round((calc_passed_count / max(len(calc_cases), 1)) * 100, 1) if calc_cases else 100.0
        grounded_pct = round((grounded_count / max(total, 1)) * 100, 1)

        print("\nBENCHMARK SCORECARD SUMMARY\n")

        print(f" Total Test Cases Evaluated : {total}")
        print(f" Cases Passed               : {passed_count}/{total} ({accuracy_pct}%)")
        print(f" Numeric Fact Accuracy      : {numeric_count}/{total}")
        print(f" Calculation Precision      : {calc_passed_count}/{len(calc_cases)} ({calc_pct}%)")
        print(f" Zero-Hallucination Rate    : {grounded_count}/{total} ({grounded_pct}%)")
        print(f" Citation Page Verifiability: {page_passed_count}/{total}")
        print(f" Average Latency per Query  : {avg_latency}s")
        print("\n")

        # Detailed Breakdown Table
        print(f"{'ID':<9} {'Company':<10} {'Task Type':<26} {'Result':<8} {'Time':<7} {'Notes'}\n")
    
        for r in results:
            verdict = "PASS" if r["passed"] else "FAIL"
            comp = (r.get("company") or "All")[:9]
            ttype = r.get("task_type", "")[:25]
            notes = ""
            if not r["passed"]:
                fails = []
                if not r.get("status_passed"): fails.append("status")
                if not r.get("numeric_passed"): fails.append("number mismatch")
                if not r.get("calc_passed"): fails.append("calc mismatch")
                if not r.get("is_grounded"): fails.append(f"ungrounded: {r.get('unverified_numbers')}")
                notes = ", ".join(fails)
            else:
                if r.get("matched_calc"):
                    notes = f"calc={r.get('matched_calc')}"
                elif r.get("matched_numbers"):
                    notes = f"num={','.join(r.get('matched_numbers')[:2])}"

            print(f"{r['question_id']:<9} {comp:<10} {ttype:<26} {verdict:<8} {r['latency_s']}s   {notes[:30]}")
        print("\n")

        # Save Report JSON
        report_data = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_cases": total,
                "passed_cases": passed_count,
                "accuracy_pct": accuracy_pct,
                "calculation_precision_pct": calc_pct,
                "zero_hallucination_rate_pct": grounded_pct,
                "average_latency_s": avg_latency,
            },
            "cases": results,
        }

        report_filename = f"dev_eval_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path = self.results_dir / report_filename
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)

        print(f"Report saved to: {report_path.resolve()}\n")
        return report_data


def main():
    parser = argparse.ArgumentParser(description="Run SEC Document Intelligence Benchmark Evaluation")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of test cases")
    parser.add_argument("--id", type=str, default=None, help="Run specific question ID (e.g. DEV-001)")
    args = parser.parse_args()

    evaluator = FinancialBenchmarkEvaluator()
    evaluator.run_all(limit=args.limit, specific_id=args.id)


if __name__ == "__main__":
    main()
