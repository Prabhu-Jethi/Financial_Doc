'''Unit Tests: Validates deterministic Decimal precision, margin formulas, YoY growth and edge cases.'''

from decimal import Decimal
from pathlib import Path
import pytest
import sys
from app.services.calculations import FinancialCalculator, OperandInput

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class TestFinanceCalculations:
    def setup_method(self):
        self.calc = FinancialCalculator()

    def test_parse_decimal_currency_and_commas(self):
        assert self.calc.parse_decimal("$391,035") == Decimal("391035")
        assert self.calc.parse_decimal("1,234.56") == Decimal("1234.56")

    def test_parse_decimal_accounting_parenthesis(self):
        assert self.calc.parse_decimal("(17,729)") == Decimal("-17729")
        assert self.calc.parse_decimal("($9,451)") == Decimal("-9451")

    def test_parse_decimal_scale_suffixes(self):
        """Should strip 'M', 'B', and '%' suffixes."""
        assert self.calc.parse_decimal("$107,556M") == Decimal("107556")
        assert self.calc.parse_decimal("21.94%") == Decimal("21.94")

    def test_parse_decimal_invalid_raises_value_error(self):
        """Should raise ValueError for non-numeric junk."""
        with pytest.raises(ValueError):
            self.calc.parse_decimal("N/A")
        with pytest.raises(ValueError):
            self.calc.parse_decimal("")


## Margin Calculations

    def test_calculate_operating_margin(self):
        # Apple FY24: Operating Income $123,216M / Total Net Sales $391,035M = 31.51%
        op_inc = Decimal("123216")
        rev = Decimal("391035")
        result = self.calc.compute_operating_margin(op_inc, rev)
        assert result.display_value == "31.51"
        assert result.unit == "%"
        assert "(Operating Income / Total Net Sales) * 100" in result.formula

    def test_calculation_margin_zero_revenue(self):
        # Division by zero_protection
        with pytest.raises(ZeroDivisionError):
            self.calc.compute_operating_margin(Decimal("100"), Decimal("0"))

    def test_compute_gross_margin(self):
         # Apple FY24: Gross Profit $180,683M / Total Net Sales $391,035M = 46.21%
        gp = Decimal("180683")
        rev = Decimal("391035")
        result = self.calc.compute_gross_margin(gp, rev)
        assert result.display_value == "46.21"
        assert result.unit == "%"

    def test_compute_net_margin(self):
        # Apple FY24: Net Income $93,736M / Total Net Sales $391,035M = 23.97%
        ni = Decimal("93736")
        rev = Decimal("391035")
        result = self.calc.compute_net_margin(ni, rev)
        assert result.display_value == "23.97"
        assert result.unit == "%"


## YoY - Growth Calcualtions

    def test_calculate_yoy_growth_positive(self):
        # Meta FY24 Revenue $164,501M vs FY23 $134,902M = +21.94%
        curr_val = Decimal("164581")
        prior_val = Decimal("134902")
        result = self.calc.compute_percentage_growth(curr_val, prior_val)
        assert result.display_value == "+22.00"
        assert result.unit == "%"

    def test_calculate_yoy_growth_negative(self):
        # Negative base period: from $(100)M to $50M profit
        current_val = Decimal("50")
        prior_val = Decimal("-100")
        result = self.calc.compute_percentage_growth(current_val, prior_val)
        # ((50 - (-100)) / |-100|) * 100 = (150 / 100) * 100 = +150.00%
        assert result.display_value == "+150.00"
        assert result.unit == "%"

    def test_compute_percentage_growth_zero_prior_value(self):
        with pytest.raises(ZeroDivisionError):
            self.calc.compute_percentage_growth(Decimal("100"), Decimal("0"))

## Variance, Working capital and free cash flow
    
    def test_calculate_dollar_variance(self):
        # FY24: $164,501M - FY23: $134,902M = +$29,599M
        current_val = Decimal("164501")
        prior_val = Decimal("134902")
        result = self.calc.compute_dollar_variance(current_val, prior_val)
        assert result.display_value == "+29599.00"

    def test_calculate_free_cash_flow(self):
        # FCF = Op Cash Flow $118,254M - CapEx $9,451M = $108,803M
        ocf = Decimal("118254")
        capex = Decimal("9451")
        result = self.calc.compute_free_cash_flow(ocf, capex, precision=0)
        assert result.display_value == "108803"

    def test_compute_free_cash_flow_with_negative_parentheses_capex(self):
        # Financial statements often write CapEx as outflow in parentheses: ($9,451)
        result = self.calc.compute_free_cash_flow(
            operating_cash_flow=OperandInput("OCF", "118254"),
            capital_expenditures=OperandInput("CapEx", "($9,451)"),
            precision=0
        )
        assert result.display_value == "108803"

    def test_compute_working_capital(self):
        # Working Capital = Current Assets $150,000M - Current Liabilities $100,000M = $50,000M
        ca = Decimal("150000")
        cl = Decimal("100000")
        result = self.calc.compute_working_capital(ca, cl, precision=0)
        assert result.display_value == "50000"


def main():
    print("Running FinancialCalculator unit tests with pytest...\n")
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()