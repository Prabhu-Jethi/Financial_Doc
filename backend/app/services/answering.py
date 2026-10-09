import re
from typing import List, Any, Dict, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document

from .retrieval import FinancialRetriever
from ..integrations.models import ModelService
from ..schemas import AnswerStatus, Citation

SYSTEM_PROMPT = """You are a senior financial analyst assistant specializing in SEC Form 10-K filings.
Answer the user's question using ONLY the provided filing excerpts.

Rules:
1. Financial Accuracy: Do not guess or extrapolate numbers. State numbers with exact scale ($ in millions).
2. Sourced Citations: For every numeric claim, cite the exact printed page and statement (e.g. "Item 8, Page 29").
3. Comparative Scope: Note that a single annual report (like FY2024 Form 10-K) contains comparative data for prior years (FY23 and FY22).
4. Insufficient Evidence: If the provided excerpts do not contain the answer, explicitly state: "The provided filings do not contain sufficient evidence to answer this question."
Context Excerpts from 10-K:
{context}
"""

class AnswerService:
    def __init__(self, retriever: FinancialRetriever = None, llm: Optional[Any] = None):
        self.retriever = retriever or FinancialRetriever()
        self.llm = llm or ModelService().get_chat_llm(temperature=0.0)
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", "{question}")
        ])

    def _extract_fiscal_year(self, doc_id: Optional[str]) -> int:
        """Extracts fiscal year from document_id (e.g., 'aapl-2024-10k' -> 2024)."""
        if doc_id:
            match = re.search(r"(202\d)", doc_id)
            if match:
                return int(match.group(1))
        return 2024


    def answer_query(self, question: str, company: str = "Apple Inc."):
        ## 1. Retrieve evidence docuements
        docs: List[Document] = self.retriever.invoke(question)

        # 2. Financial Guardrail: Zero hallucination on empty retrieval
        if not docs:
            return {
                "answer_text": "The provided filings do not contain sufficient evidence to answer this question.",
                "citations": [],
                "status": AnswerStatus.INSUFFICIENT_EVIDENCE,
                "docs": []
            }
        
        ## 3. Format context string
        context_text = "\n\n---\n\n".join([
            f"Filling: {d.metadata.get('document_id')} | Page: {d.metadata.get('printed_page')} | Section: {d.metadata.get('section')}\nContent:\n{d.page_content}"
            for d in docs
        ])

        ## 4. Generate answer via LCEL chain
        chain = self.prompt | self.llm | StrOutputParser()
        answer_text = chain.invoke({"context": context_text, "question": question})


         # 5. Extract citations from retrieved docs
        citations = [
            Citation(
                citation_id=str(d.metadata.get("chunk_id", "")),
                company=company,
                report_year=self._extract_fiscal_year(d.metadata.get("document_id")),
                report_type="10-K",
                printed_page=str(d.metadata.get("printed_page", "N/A")),
                section=d.metadata.get("section", "Item 8"),
                exact_quote=d.page_content[:200] + ("..." if len(d.page_content) > 200 else ""),
                document_id=d.metadata.get("document_id")
            )
            for d in docs
        ]

        return {
            "answer_text": answer_text,
            "citations": citations,
            "status": AnswerStatus.ANSWERED,
            "docs": docs
        }


def main():
    print("\nTesting AnswerService End-to-End Pipeline")
    service = AnswerService()

    test_question = "What were Apple's total net sales in fiscal year 2024?"
    print(f"\nQuery: {test_question}\n")
    result = service.answer_query(test_question)

    print(f"Status: {result['status']}")
    print(f"\nAnswer:\n{result['answer_text']}\n")
    print(f"Total Citations: {len(result['citations'])}")

    for idx, c in enumerate(result['citations'], 1):
        print(f"  [{idx}] Page: {c.printed_page} | Section: {c.section} | Doc: {c.document_id}")
        print(f"      Snippet: {c.exact_quote[:100]}...\n")




if __name__ == "__main__":
    main()