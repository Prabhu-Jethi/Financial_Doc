import json
import re
from typing import List, Any, Dict, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document

from .retrieval import FinancialRetriever
from .evidence import EvidenceService
from ..integrations.models import ModelService
from ..services.calculations import FinancialCalculator, OperandInput
from ..schemas import AnswerStatus, Citation, CalculationLedgerItem, CalculationOperand, VerifiedFact

SYSTEM_PROMPT = """You are a senior financial analyst assistant specializing in SEC Form 10-K filings for public corporations (Apple, Amazon, Meta, Microsoft, etc.).
Answer the user's question using ONLY the provided filing excerpts.

Rules:
1. Financial Accuracy: Do not guess or extrapolate numbers. State numbers with exact scale ($ in millions).
2. Sourced Citations: For every numeric claim, cite the exact printed page and statement (e.g. "Item 8, Page 29").
3. Comparative Scope: Note that a single annual report (like FY2024 Form 10-K) contains comparative data for prior years (FY23 and FY22).
4. Insufficient Evidence: If the provided excerpts do not contain the answer, explicitly state: "The provided filings do not contain sufficient evidence to answer this question."
5. Direct & High-Signal Style for Short Queries: Users often ask terse shorthand questions (e.g. "meta's 2024 fiscal year revenue?", "amazon growth in 2023"). Answer directly in the very first sentence with the exact reported number and units, then provide brief context and page citations. Map common terms accurately:
   - "revenue" / "sales" -> Total net sales or Revenue line item
   - "growth" -> State both dollar change and percentage change (e.g. "+$7,750M or +2.02%")
   - "profit" / "operating profit" -> Operating income
   - "cash" -> Cash and cash equivalents
6. Audited Calculations: If the context includes an [AUDITED CALCULATION LEDGER RESULTS] section, you MUST use the exact computed result from the calculation ledger (e.g., 31.51%, +0.30%). Cite the formula, the exact reported operands, and their source pages. DO NOT perform alternative math, recalculate, or round differently.

Context Excerpts from 10-K:
{context}
"""

CALCULATION_EXTRACTION_PROMPT = """You are an SEC filing financial analyst.
Analyze the user's question and the retrieved 10-K excerpts.
Determine if the user's question requires a mathematical calculation (operating margin, gross margin, net margin, percentage growth / YoY growth, dollar variance, free cash flow, working capital).

If NO calculation is requested, return an empty JSON array: []

If a calculation IS requested:
Extract the EXACT reported numerical values, line item names, source statement, and printed page numbers from the excerpts.
DO NOT calculate the math yourself. Only extract the operands as reported in the filing excerpts.

Supported calculation types and expected operands:
- "operating_margin": operand 0 = Operating Income / Income from operations, operand 1 = Total Net Sales / Revenue / Total revenue (Microsoft)
- "gross_margin": operand 0 = Gross Profit, operand 1 = Total Net Sales / Revenue
- "net_margin": operand 0 = Net Income, operand 1 = Total Net Sales / Revenue
- "percentage_growth": operand 0 = Current Period Value, operand 1 = Prior Period Baseline Value
- "dollar_variance": operand 0 = Current Period Value, operand 1 = Prior Period Baseline Value
- "free_cash_flow": operand 0 = Operating Cash Flow, operand 1 = Capital Expenditures / Payments for PPE
- "working_capital": operand 0 = Total Current Assets, operand 1 = Total Current Liabilities

Return ONLY valid JSON matching this schema:
[
  {{
    "calculation_type": "operating_margin",
    "metric_label": "Descriptive label (e.g. 'Operating Margin', 'iPhone Net Sales YoY Growth')",
    "operands": [
      {{
        "name": "Exact line item and period (e.g. 'Operating Income FY2024')",
        "value": "123,216",
        "source_statement": "Consolidated Statements of Operations",
        "printed_page": "29"
      }},
      {{
        "name": "Exact line item and period (e.g. 'Total Net Sales FY2024')",
        "value": "391,035",
        "source_statement": "Consolidated Statements of Operations",
        "printed_page": "29"
      }}
    ]
  }}
]

Context:
{context}

Question: {question}
"""

class AnswerService:
    def __init__(self, retriever: FinancialRetriever = None, llm: Optional[Any] = None):
        self.retriever = retriever or FinancialRetriever()
        self.llm = llm or ModelService().get_chat_llm(temperature=0.0)
        self.calculator = FinancialCalculator()
        self.evidence_service = EvidenceService()
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", "{question}")
        ])
        self.calc_prompt = ChatPromptTemplate.from_messages([
            ("system", CALCULATION_EXTRACTION_PROMPT),
            ("human", "{question}")
        ])

    def _extract_fiscal_year(self, doc_id: Optional[str]) -> int:
        """Extracts fiscal year from document_id (e.g., 'aapl-2024-10k' -> 2024)."""
        if doc_id:
            match = re.search(r"(202\d)", doc_id)
            if match:
                return int(match.group(1))
        return 2024

    def _detect_and_compute_calculations(
        self, question: str, docs: List[Document], context_text: str
    ) -> List[CalculationLedgerItem]:
        """
        Detects calculation requests, extracts reported operands from context, 
        and executes deterministic Python Decimal math via FinancialCalculator.
        """
        calc_keywords = [
            "margin", "growth", "variance", "free cash flow", "fcf",
            "working capital", "percentage change", "yoy", "year-over-year",
            "rate of growth", "operating ratio", "dollar change", "increase in %"
        ]
        q_lower = question.lower()
        if not any(kw in q_lower for kw in calc_keywords):
            return []

        ledger_items: List[CalculationLedgerItem] = []

        try:
            # 1. LLM structured operand extraction
            calc_chain = self.calc_prompt | self.llm | StrOutputParser()
            raw_response = calc_chain.invoke({"context": context_text, "question": question})

            # Clean markdown JSON wrapping if present
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                cleaned = re.sub(r"\s*```$", "", cleaned)

            # Match JSON array
            match = re.search(r"\[\s*\{.*\}\s*\]", cleaned, re.DOTALL)
            json_str = match.group(0) if match else cleaned

            parsed = json.loads(json_str)
            if isinstance(parsed, list):
                for item in parsed:
                    c_type = item.get("calculation_type")
                    operands = item.get("operands", [])
                    metric_label = item.get("metric_label", "Metric")

                    if len(operands) < 2:
                        continue

                    op0 = operands[0]
                    op1 = operands[1]

                    if c_type == "operating_margin":
                        res = self.calculator.compute_operating_margin(op0, op1)
                        ledger_items.append(res)
                    elif c_type == "gross_margin":
                        res = self.calculator.compute_gross_margin(op0, op1)
                        ledger_items.append(res)
                    elif c_type == "net_margin":
                        res = self.calculator.compute_net_margin(op0, op1)
                        ledger_items.append(res)
                    elif c_type == "percentage_growth":
                        res = self.calculator.compute_percentage_growth(op0, op1, metric_label=metric_label)
                        ledger_items.append(res)
                    elif c_type == "dollar_variance":
                        res = self.calculator.compute_dollar_variance(op0, op1, metric_label=metric_label)
                        ledger_items.append(res)
                    elif c_type == "free_cash_flow":
                        res = self.calculator.compute_free_cash_flow(op0, op1)
                        ledger_items.append(res)
                    elif c_type == "working_capital":
                        res = self.calculator.compute_working_capital(op0, op1)
                        ledger_items.append(res)
        except Exception as e:
            print(f"[AnswerService] Calculation extraction error: {e}")

        # 2. Fallback heuristic extraction if extraction returned empty
        if not ledger_items and "operating margin" in q_lower:
            heuristic_item = self._heuristic_operating_margin(docs)
            if heuristic_item:
                ledger_items.append(heuristic_item)

        return ledger_items

    def _heuristic_operating_margin(self, docs: List[Document]) -> Optional[CalculationLedgerItem]:
        """Regex-based fallback extraction for Operating Margin from retrieved chunks."""
        for d in docs:
            content = d.page_content
            op_match = re.search(r"(?:operating income|income from operations)[^\d$]*\$?\s*([0-9,]+)", content, re.IGNORECASE)
            sales_match = re.search(r"(?:total net sales|total revenue|net sales|revenue)[^\d$]*\$?\s*([0-9,]+)", content, re.IGNORECASE)
            if op_match and sales_match:
                op_val = op_match.group(1).replace(",", "")
                sales_val = sales_match.group(1).replace(",", "")
                try:
                    page = str(d.metadata.get("printed_page", "N/A"))
                    stmt = str(d.metadata.get("section", "Statements of Operations"))
                    return self.calculator.compute_operating_margin(
                        operating_income=OperandInput("Operating Income", op_val, source_statement=stmt, printed_page=page),
                        net_sales=OperandInput("Total Net Sales", sales_val, source_statement=stmt, printed_page=page)
                    )
                except Exception:
                    pass
        return None

    def answer_query(self, question: str, company: Optional[str] = None, document_id: Optional[str] = None):
        ## Configure dynamic retrieval filters (reset per request to prevent cross-query leakage)
        q_lower = question.lower()
        if any (trigger in q_lower for trigger in ["buy or sell", "buy/sell", "should i buy", "should i sell", "invest in", "stock advice"]):
            return {
                "answer_text": "I can only provide factual historical financial data and calculations from filed SEC reports. Per policy, I cannot provide investment advice, stock recommendations, or buy/sell guidance.",
                "citations": [],
                "facts": [],
                "status": AnswerStatus.OUT_OF_SCOPE,
                "docs": [],
                "calculations": [],
                "missing_information": ["Query requested investment/trading advice which is out of scope per policy."]
            }
        
        self.retriever.document_id = document_id if document_id else None
        if company in ["All", "Cross-Company", None]:
            self.retriever.company = None
        else:
            self.retriever.company = company

        ## 1. Retrieve evidence documents
        docs: List[Document] = self.retriever.invoke(question)

        # 2. Financial Guardrail: Zero hallucination on empty retrieval
        if not docs:
            return {
                "answer_text": "The provided filings do not contain sufficient evidence to answer this question.",
                "citations": [],
                "status": AnswerStatus.INSUFFICIENT_EVIDENCE,
                "docs": [],
                "calculations": []
            }
        
        ## 3. Format context string
        context_text = "\n\n---\n\n".join([
            f"Filing: {d.metadata.get('document_id')} | Page: {d.metadata.get('printed_page')} | Section: {d.metadata.get('section')}\nContent:\n{d.page_content}"
            for d in docs
        ])

        ## 4. Deterministic Calculation Resolution
        calculations = self._detect_and_compute_calculations(question, docs, context_text)

        # Enrich context with audited calculation results so the LLM output is 100% harmonized
        augmented_context = context_text
        if calculations:
            calc_blocks = []
            for c in calculations:
                ops_str = ", ".join([f"{op.name} = {op.raw_value} (Page {op.printed_page})" for op in c.operands])
                calc_blocks.append(
                    f"Formula: {c.formula}\n"
                    f"Operands: {ops_str}\n"
                    f"Deterministic Result: {c.display_value}{c.unit}"
                )
            augmented_context += "\n\n[AUDITED CALCULATION LEDGER RESULTS]\n" + "\n\n".join(calc_blocks)

        ## 5. Generate answer via LCEL chain
        chain = self.prompt | self.llm | StrOutputParser()
        answer_text = chain.invoke({"context": augmented_context, "question": question})

        ## 6. Validate Evidence, Provenance Citations, and Numerical Grounding
        validation = self.evidence_service.validate_and_enrich_result(
            question=question,
            answer_text=answer_text,
            docs=docs,
            calculations=calculations,
            company=company
        )

        return {
            "answer_text": answer_text,
            "citations": validation["citations"],
            "facts": validation["facts"],
            "calculations": calculations,
            "status": validation["status"],
            "docs": docs,
            "missing_information": validation["missing_information"],
            "audit_report": validation["audit"]
        }


def main():
    print("\nTesting AnswerService End-to-End Pipeline")
    service = AnswerService()

    test_question = "What were Apple's total net sales in fiscal year 2024?"
    print(f"\nQuery 1 (Factual): {test_question}\n")
    result = service.answer_query(test_question)

    print(f"Status: {result['status']}")
    print(f"\nAnswer:\n{result['answer_text']}\n")
    print(f"Total Citations: {len(result['citations'])}")
    print(f"Calculations: {len(result['calculations'])}")

    test_calc_question = "What was Apple's operating margin for fiscal year 2024?"
    print(f"\nQuery 2 (Calculation): {test_calc_question}\n")
    result_calc = service.answer_query(test_calc_question)
    print(f"Status: {result_calc['status']}")
    print(f"\nAnswer:\n{result_calc['answer_text']}\n")
    print(f"Total Citations: {len(result_calc['citations'])}")
    print(f"Calculations: {len(result_calc['calculations'])}")
    for c in result_calc["calculations"]:
        print(f"  Ledger Item: {c.formula} -> {c.display_value}{c.unit}")
        for op in c.operands:
            print(f"    Operand: {op.name} = {op.raw_value} (Page {op.printed_page})")


if __name__ == "__main__":
    main()