/**
 * Utility for exporting audit-grade financial models to Excel Spreadsheet XML (.xls)
 * Opens natively in Microsoft Excel, Apple Numbers, and Google Sheets with live formulas!
 */

export function exportFinancialModelToExcel(item) {
  const company = item.company || "Corporate Disclosure";
  const title = item.comparison_table?.title || `DocIntel Analysis - ${company}`;
  const period = item.reporting_periods?.join(", ") || "FY2024";
  const dateStr = new Date().toISOString().split("T")[0];

  const rows = item.comparison_table?.rows || [];
  const columns = item.comparison_table?.columns || ["Metric", "Prior Period", "Current Period", "Variance ($)", "Variance (%)", "Source Filing"];

  // Helper to parse numerical string (e.g. "$391,035" -> 391035, "31.02%" -> 0.3102)
  const parseNum = (str) => {
    if (!str || typeof str !== "string") return null;
    const clean = str.replace(/[$,\s]/g, "");
    if (clean.endsWith("%")) {
      const val = parseFloat(clean.replace("%", ""));
      return isNaN(val) ? null : val / 100;
    }
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  };

  // Build Excel XML Rows with live dynamic formulas
  let tableRowsXml = "";
  rows.forEach((row, idx) => {
    const excelRowIndex = 7 + idx; // 1-based index in Excel
    const priorNum = parseNum(row.prior_period);
    const currNum = parseNum(row.current_period);

    // Build cells:
    // Col 1: Metric name
    // Col 2: Prior period (Number)
    // Col 3: Current period (Number)
    // Col 4: Variance Dollar Formula: =C[row]-B[row]
    // Col 5: Variance Percent Formula: =(C[row]-B[row])/B[row]
    // Col 6: Source quote / reference

    const priorCell = priorNum !== null
      ? `<Cell ss:StyleID="sNum"><Data ss:Type="Number">${priorNum}</Data></Cell>`
      : `<Cell ss:StyleID="sText"><Data ss:Type="String">${row.prior_period || "-"}</Data></Cell>`;

    const currCell = currNum !== null
      ? `<Cell ss:StyleID="sNumBold"><Data ss:Type="Number">${currNum}</Data></Cell>`
      : `<Cell ss:StyleID="sText"><Data ss:Type="String">${row.current_period || "-"}</Data></Cell>`;

    // If both are valid numbers, generate true Excel formulas
    const varDollarCell = (currNum !== null && priorNum !== null)
      ? `<Cell ss:StyleID="sNum" ss:Formula="=RC[-1]-RC[-2]"><Data ss:Type="Number">${currNum - priorNum}</Data></Cell>`
      : `<Cell ss:StyleID="sText"><Data ss:Type="String">${row.variance_dollar || "-"}</Data></Cell>`;

    const varPctCell = (currNum !== null && priorNum !== null && priorNum !== 0)
      ? `<Cell ss:StyleID="sPercent" ss:Formula="=(RC[-2]-RC[-3])/RC[-3]"><Data ss:Type="Number">${(currNum - priorNum) / priorNum}</Data></Cell>`
      : `<Cell ss:StyleID="sText"><Data ss:Type="String">${row.variance_pct || "-"}</Data></Cell>`;

    tableRowsXml += `
      <Row>
        <Cell ss:StyleID="sMetric"><Data ss:Type="String">${row.metric}</Data></Cell>
        ${priorCell}
        ${currCell}
        ${varDollarCell}
        ${varPctCell}
        <Cell ss:StyleID="sSource"><Data ss:Type="String">${row.source || company + " 10-K"}</Data></Cell>
      </Row>`;
  });

  // Citations / Provenance rows
  let citationsRowsXml = "";
  if (item.citations && item.citations.length > 0) {
    citationsRowsXml = `
      <Row ss:Height="12"></Row>
      <Row>
        <Cell ss:MergeAcross="5" ss:StyleID="sSubHeader"><Data ss:Type="String">GROUNDED CITATIONS &amp; SEC FILING PROVENANCE</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">#</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Company</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Printed Page</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Section</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="sHeader"><Data ss:Type="String">Exact SEC 10-K Disclosed Quote</Data></Cell>
      </Row>
      ${item.citations.map((c, i) => `
        <Row>
          <Cell ss:StyleID="sTextCenter"><Data ss:Type="Number">${i + 1}</Data></Cell>
          <Cell ss:StyleID="sText"><Data ss:Type="String">${c.company || company}</Data></Cell>
          <Cell ss:StyleID="sTextCenter"><Data ss:Type="String">Page ${c.printed_page}</Data></Cell>
          <Cell ss:StyleID="sText"><Data ss:Type="String">${c.section || "Financial Statements"}</Data></Cell>
          <Cell ss:MergeAcross="1" ss:StyleID="sQuote"><Data ss:Type="String">${c.exact_quote ? c.exact_quote.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : "-"}</Data></Cell>
        </Row>
      `).join("")}
    `;
  }

  // Full Excel Spreadsheet XML Document
  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sTitle">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Color="#1E1E1E" ss:Bold="1"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sMeta">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#555555" ss:Italic="1"/>
  </Style>
  <Style ss:ID="sSubHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#2B2B2B" ss:Bold="1"/>
   <Interior ss:Color="#EAEAEA" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#2B2B2B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B3B3B3"/>
   </Borders>
  </Style>
  <Style ss:ID="sMetric">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#2B2B2B" ss:Bold="1"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sNum">
   <Font ss:FontName="Courier New" ss:Size="10" ss:Color="#2B2B2B"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00;(#,##0.00);&quot;-&quot;"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumBold">
   <Font ss:FontName="Courier New" ss:Size="10" ss:Color="#111111" ss:Bold="1"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00;(#,##0.00);&quot;-&quot;"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sPercent">
   <Font ss:FontName="Courier New" ss:Size="10" ss:Color="#137333" ss:Bold="1"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="+0.0%;-0.0%;0.0%"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sText">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#383838"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sTextCenter">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#383838"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sSource">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Color="#666666"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sQuote">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Color="#444444" ss:Italic="1"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Financial Comparison">
  <Table ss:ExpandedColumnCount="7" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="160"/>
   <Column ss:Width="105"/>
   <Column ss:Width="105"/>
   <Column ss:Width="105"/>
   <Column ss:Width="95"/>
   <Column ss:Width="280"/>

   <Row ss:Height="24">
    <Cell ss:MergeAcross="5" ss:StyleID="sTitle"><Data ss:Type="String">${title}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="sMeta"><Data ss:Type="String">Scope: ${company} • Period: ${period} • Generated: ${dateStr} • DocIntel Verification</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>

   <!-- Table Headers -->
   <Row ss:Height="22">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${columns[0] || "Financial Metric"}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${columns[1] || "Prior Period"}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${columns[2] || "Current Period"}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${columns[3] || "Variance ($)"}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${columns[4] || "Variance (%)"}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${columns[5] || "Source Filing"}</Data></Cell>
   </Row>

   <!-- Table Data Rows with Formulas -->
   ${tableRowsXml}

   <!-- Citations / Audit Trail -->
   ${citationsRowsXml}

  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
  a.download = `DocIntel_Financial_Model_${safeCompany}_${dateStr}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

