from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import List, Optional, Union, Dict, Any
import re

from ..schemas import CalculationOperand, CalculationLedgerItem


class OperandInput:
    """
    Convenience wrapper to construct CalculationOperand with validation.
    Accepts string, int, float, or Decimal values.
    """
    def __init__(
        self,
        name: str,
        value: Union[str, int, float, Decimal],
        source_statement: Optional[str] = None,
        printed_page: Optional[str] = None
    ):
        self.name = name
        self.raw_value = str(value)
        self.source_statement = source_statement
        self.printed_page = str(printed_page) if printed_page is not None else "N/A"

    def to_operand(self) -> CalculationOperand:
        return CalculationOperand(
            name=self.name,
            raw_value=self.raw_value,
            source_statement=self.source_statement,
            printed_page=self.printed_page
        )


class FinancialCalculator:
    """
    Auditable deterministic financial calculation engine compliant with rules.md § 5 & TRD § 2.
    
    Guarantees:
    1. Zero Math Hallucination: Uses pure Python Decimal arithmetic, never floating point or LLM generation.
    2. Exact Provenance: Tracks source statement and page for every operand in an auditable ledger.
    3. Scale & Unit Integrity: Emits standardized displays (e.g. 31.51%, +$7,750M) with explicit units.
    """

    @staticmethod
    def parse_decimal(value: Union[str, int, float, Decimal]) -> Decimal:
        """
        Parses financial string or number into exact Decimal.
        Handles accounting parentheses: '(12,800)' -> -12800.
        Strips currency symbols ('$'), commas, suffixes ('M', 'B'), and percentages ('%').
        """
        if isinstance(value, Decimal):
            return value
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        
        val_str = str(value).strip()
        if not val_str:
            raise ValueError("Cannot parse empty value as Decimal.")

        # Check for accounting negative in parentheses: (1,234) -> -1234
        is_negative = False
        if val_str.startswith("(") and val_str.endswith(")"):
            is_negative = True
            val_str = val_str[1:-1].strip()
        elif val_str.startswith("-"):
            is_negative = True
            val_str = val_str[1:].strip()

        # Remove currency symbols, commas, and scale letters
        cleaned = re.sub(r"[$,\s%MBmb]", "", val_str)

        try:
            dec = Decimal(cleaned)
            return -dec if is_negative else dec
        except InvalidOperation as e:
            raise ValueError(f"Invalid financial number format: '{value}'") from e

    @staticmethod
    def format_decimal(
        d: Decimal,
        precision: int = 2,
        include_sign: bool = False
    ) -> str:
        """
        Formats a Decimal with exact precision using ROUND_HALF_UP.
        Optionally prefixes positive numbers with '+' (e.g., '+2.02').
        """
        quantize_pattern = Decimal("1." + "0" * precision) if precision > 0 else Decimal("1")
        quantized = d.quantize(quantize_pattern, rounding=ROUND_HALF_UP)
        
        if include_sign and quantized > Decimal("0"):
            return f"+{quantized}"
        return str(quantized)

    def _resolve_operand(
        self,
        item: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        default_name: str
    ) -> tuple[Decimal, CalculationOperand]:
        """Resolves various operand representations into (Decimal, CalculationOperand)."""
        if isinstance(item, CalculationOperand):
            dec = self.parse_decimal(item.raw_value)
            return dec, item
        elif isinstance(item, OperandInput):
            dec = self.parse_decimal(item.raw_value)
            return dec, item.to_operand()
        elif isinstance(item, dict):
            name = item.get("name", default_name)
            raw = str(item.get("raw_value", item.get("value", "0")))
            statement = item.get("source_statement")
            page = str(item.get("printed_page", "N/A"))
            dec = self.parse_decimal(raw)
            return dec, CalculationOperand(name=name, raw_value=raw, source_statement=statement, printed_page=page)
        else:
            dec = self.parse_decimal(item)
            return dec, CalculationOperand(name=default_name, raw_value=str(item), printed_page="N/A")

    # -------------------------------------------------------------------------
    # Core Financial Formula Implementations
    # -------------------------------------------------------------------------

    def compute_operating_margin(
        self,
        operating_income: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        net_sales: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: (Operating Income / Total Net Sales) * 100
        Unit: '%'
        Example (Apple FY2024 DEV-006): ($123,216M / $391,035M) * 100 = 31.51%
        """
        op_inc_dec, op_inc_obj = self._resolve_operand(operating_income, "Operating Income")
        sales_dec, sales_obj = self._resolve_operand(net_sales, "Total Net Sales")

        if sales_dec == Decimal("0"):
            raise ZeroDivisionError("Cannot compute operating margin: Total Net Sales is zero.")

        ratio = (op_inc_dec / sales_dec) * Decimal("100")
        display_val = self.format_decimal(ratio, precision=precision)

        return CalculationLedgerItem(
            formula="(Operating Income / Total Net Sales) * 100",
            operands=[op_inc_obj, sales_obj],
            display_value=display_val,
            unit="%"
        )

    def compute_gross_margin(
        self,
        gross_profit: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        net_sales: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: (Gross Profit / Total Net Sales) * 100
        Unit: '%'
        """
        gp_dec, gp_obj = self._resolve_operand(gross_profit, "Gross Profit")
        sales_dec, sales_obj = self._resolve_operand(net_sales, "Total Net Sales")

        if sales_dec == Decimal("0"):
            raise ZeroDivisionError("Cannot compute gross margin: Total Net Sales is zero.")

        ratio = (gp_dec / sales_dec) * Decimal("100")
        display_val = self.format_decimal(ratio, precision=precision)

        return CalculationLedgerItem(
            formula="(Gross Profit / Total Net Sales) * 100",
            operands=[gp_obj, sales_obj],
            display_value=display_val,
            unit="%"
        )

    def compute_net_margin(
        self,
        net_income: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        net_sales: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: (Net Income / Total Net Sales) * 100
        Unit: '%'
        """
        ni_dec, ni_obj = self._resolve_operand(net_income, "Net Income")
        sales_dec, sales_obj = self._resolve_operand(net_sales, "Total Net Sales")

        if sales_dec == Decimal("0"):
            raise ZeroDivisionError("Cannot compute net margin: Total Net Sales is zero.")

        ratio = (ni_dec / sales_dec) * Decimal("100")
        display_val = self.format_decimal(ratio, precision=precision)

        return CalculationLedgerItem(
            formula="(Net Income / Total Net Sales) * 100",
            operands=[ni_obj, sales_obj],
            display_value=display_val,
            unit="%"
        )

    def compute_percentage_growth(
        self,
        current_value: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        prior_value: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        metric_label: str = "Metric",
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: ((Current Period - Prior Period) / |Prior Period|) * 100
        Unit: '%'
        Example (Apple iPhone FY24 vs FY23 DEV-007): (($201,183 - $200,583) / $200,583) * 100 = +0.30%
        """
        cur_dec, cur_obj = self._resolve_operand(current_value, f"{metric_label} (Current Period)")
        prior_dec, prior_obj = self._resolve_operand(prior_value, f"{metric_label} (Prior Period)")

        if prior_dec == Decimal("0"):
            raise ZeroDivisionError("Cannot compute percentage growth: Prior period base is zero.")

        diff = cur_dec - prior_dec
        ratio = (diff / abs(prior_dec)) * Decimal("100")
        display_val = self.format_decimal(ratio, precision=precision, include_sign=True)

        return CalculationLedgerItem(
            formula=f"(({metric_label} Current - Prior) / |Prior|) * 100",
            operands=[cur_obj, prior_obj],
            display_value=display_val,
            unit="%"
        )

    def compute_dollar_variance(
        self,
        current_value: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        prior_value: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        metric_label: str = "Metric",
        unit: str = "USD in millions",
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: Current Period - Prior Period
        Unit: Currency scale (default: 'USD in millions')
        Example: $391,035M - $383,285M = +$7,750M
        """
        cur_dec, cur_obj = self._resolve_operand(current_value, f"{metric_label} (Current Period)")
        prior_dec, prior_obj = self._resolve_operand(prior_value, f"{metric_label} (Prior Period)")

        diff = cur_dec - prior_dec
        display_val = self.format_decimal(diff, precision=precision, include_sign=True)

        return CalculationLedgerItem(
            formula=f"{metric_label} Current - {metric_label} Prior",
            operands=[cur_obj, prior_obj],
            display_value=display_val,
            unit=unit
        )

    def compute_working_capital(
        self,
        current_assets: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        current_liabilities: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        unit: str = "USD in millions",
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: Total Current Assets - Total Current Liabilities
        Unit: Currency scale
        """
        ca_dec, ca_obj = self._resolve_operand(current_assets, "Total Current Assets")
        cl_dec, cl_obj = self._resolve_operand(current_liabilities, "Total Current Liabilities")

        wc = ca_dec - cl_dec
        display_val = self.format_decimal(wc, precision=precision)

        return CalculationLedgerItem(
            formula="Total Current Assets - Total Current Liabilities",
            operands=[ca_obj, cl_obj],
            display_value=display_val,
            unit=unit
        )

    def compute_free_cash_flow(
        self,
        operating_cash_flow: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        capital_expenditures: Union[CalculationOperand, OperandInput, Dict[str, Any]],
        unit: str = "USD in millions",
        precision: int = 2
    ) -> CalculationLedgerItem:
        """
        Formula: Cash Provided by Operating Activities - Capital Expenditures (Payments for PPE)
        Unit: Currency scale
        """
        ocf_dec, ocf_obj = self._resolve_operand(operating_cash_flow, "Cash from Operations")
        capex_dec, capex_obj = self._resolve_operand(capital_expenditures, "Capital Expenditures (CapEx)")

        # CapEx in statements may be recorded as a negative cash outflow or positive addition
        capex_outflow = abs(capex_dec)
        fcf = ocf_dec - capex_outflow
        display_val = self.format_decimal(fcf, precision=precision)

        return CalculationLedgerItem(
            formula="Operating Cash Flow - Capital Expenditures",
            operands=[ocf_obj, capex_obj],
            display_value=display_val,
            unit=unit
        )


def main():
    """Verification harness for deterministic financial calculations."""

    calc = FinancialCalculator()

    # 1. Test DEV-006: Apple Operating Margin FY2024
    print("\n[Test 1] Operating Margin (DEV-006 Ground Truth):")
    op_margin_item = calc.compute_operating_margin(
        operating_income=OperandInput(
            name="Operating Income FY24",
            value="$123,216",
            source_statement="Consolidated Statements of Operations",
            printed_page="29"
        ),
        net_sales=OperandInput(
            name="Total Net Sales FY24",
            value="$391,035",
            source_statement="Consolidated Statements of Operations",
            printed_page="29"
        )
    )
    print(f"  Formula:       {op_margin_item.formula}")
    print(f"  Display Value: {op_margin_item.display_value}{op_margin_item.unit}")
    print(f"  Operands:      {[op.name + ': ' + op.raw_value + ' (Pg ' + op.printed_page + ')' for op in op_margin_item.operands]}")
    assert op_margin_item.display_value == "31.51", f"Expected 31.51, got {op_margin_item.display_value}"
    print("  --> PASS: Matches DEV-006 ground truth (31.51%).")

    # 2. Test DEV-007: Apple iPhone YoY Growth FY2023 to FY2024
    print("\n[Test 2] Percentage Growth (DEV-007 Ground Truth):")
    growth_item = calc.compute_percentage_growth(
        current_value=OperandInput(
            name="iPhone Sales FY24",
            value="201,183",
            source_statement="Item 7 - Results of Operations",
            printed_page="Item 7"
        ),
        prior_value=OperandInput(
            name="iPhone Sales FY23",
            value="200,583",
            source_statement="Item 7 - Results of Operations",
            printed_page="Item 7"
        ),
        metric_label="iPhone Net Sales"
    )
    print(f"  Formula:       {growth_item.formula}")
    print(f"  Display Value: {growth_item.display_value}{growth_item.unit}")
    assert growth_item.display_value == "+0.30", f"Expected +0.30, got {growth_item.display_value}"
    print("  --> PASS: Matches DEV-007 ground truth (+0.30%).")

    # 3. Test YoY Dollar Variance
    print("\n[Test 3] YoY Dollar Variance (Total Net Sales FY24 vs FY23):")
    variance_item = calc.compute_dollar_variance(
        current_value=OperandInput(name="Net Sales FY24", value="$391,035", source_statement="Operations", printed_page="29"),
        prior_value=OperandInput(name="Net Sales FY23", value="$383,285", source_statement="Operations", printed_page="29"),
        metric_label="Total Net Sales",
        precision=0
    )
    print(f"  Variance:      {variance_item.display_value} {variance_item.unit}")
    assert variance_item.display_value == "+7750", f"Expected +7750, got {variance_item.display_value}"
    print("  --> PASS: Net increase of +$7,750M verified.")

    # 4. Test Free Cash Flow with negative capex input
    print("\n[Test 4] Free Cash Flow Calculation:")
    fcf_item = calc.compute_free_cash_flow(
        operating_cash_flow=OperandInput(name="Cash from Operations", value="$118,254", source_statement="Cash Flows", printed_page="33"),
        capital_expenditures=OperandInput(name="Payments for PPE", value="($9,458)", source_statement="Cash Flows", printed_page="33"),
        precision=0
    )
    print(f"  Free Cash Flow: ${fcf_item.display_value}M")
    assert fcf_item.display_value == "108796", f"Expected 108796, got {fcf_item.display_value}"
    print("  --> PASS: Free Cash Flow of $108,796M verified.")

    print("All deterministic calculation tests PASSED successfully!")


if __name__ == "__main__":
    main()

