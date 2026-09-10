import re
import json
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from decimal import Decimal
from app.models.validation_exception import ValidationException

GSTIN_PATTERN = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")

# Valid 2-digit Indian GST State / UT Codes
VALID_GST_STATE_CODES = {
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
    "33", "34", "35", "36", "37", "38", "97", "99"
}

VALID_CURRENCIES = {"INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY", "CHF"}

ROUNDING_TOLERANCE = 0.05  # 5 paise tolerance


# ===========================================================================
# LAYER 1: BASIC FIELD INTEGRITY CHECKS
# ===========================================================================

def verify_gstin(
    gstin: Optional[str], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> Optional[ValidationException]:
    """
    Validates 15-character Indian GSTIN format and statutory state code.
    """
    val = str(gstin or "").strip().upper()
    if not val or val in ["NONE", "NULL", "N/A", "UNKNOWN", ""]:
        return None

    if not GSTIN_PATTERN.match(val):
        return ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_INVALID_GSTIN_FORMAT",
            field_name="gstin",
            severity="medium",
            title="Invalid GSTIN Format",
            explanation=f"GSTIN '{val}' does not conform to the statutory 15-character structure (2-digit state code + 10-character PAN + 1-digit entity + 'Z' + checksum).",
            observed_value=val,
            expected_value="15-character valid Indian GSTIN (e.g. 27AAACA1234A1Z5)"
        )

    # Check statutory state code
    state_code = val[:2]
    if state_code not in VALID_GST_STATE_CODES:
        return ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_GSTIN_STATE_CODE_MISMATCH",
            field_name="gstin",
            severity="medium",
            title="Invalid GSTIN State Code",
            explanation=f"GSTIN state prefix '{state_code}' is not a recognized Indian State/UT code under GST statutory schedule.",
            observed_value=state_code,
            expected_value="Valid 2-digit Indian State code (01 to 38, 97, 99)"
        )

    return None


def verify_dates_and_period(
    data: Dict[str, Any], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """Validates presence and calendrical sanity of transaction dates."""
    exceptions = []
    raw_date = data.get("invoice_date") or data.get("date") or data.get("statement_period")
    if not raw_date or str(raw_date).strip().lower() in ["none", "null", "unknown", "n/a", ""]:
        exceptions.append(ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_MISSING_OR_INVALID_DATE",
            field_name="invoice_date",
            severity="medium",
            title="Missing Transaction Date",
            explanation="Transaction date could not be identified from document text.",
            observed_value=None,
            expected_value="Valid date (YYYY-MM-DD or DD/MM/YYYY)"
        ))
        return exceptions

    # Check for impossible dates
    s = str(raw_date).strip()
    parsed_date = None
    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]:
        try:
            parsed_date = datetime.strptime(s, fmt).date()
            break
        except ValueError:
            pass

    if parsed_date:
        now_year = datetime.now().year
        if parsed_date.year < 2000 or parsed_date.year > now_year + 1:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_PERIOD_OUT_OF_BOUNDS",
                field_name="invoice_date",
                severity="medium",
                title="Transaction Date Out of Accounting Bounds",
                explanation=f"Transaction date {parsed_date.isoformat()} falls outside reasonable operational range (2000 - {now_year + 1}).",
                observed_value=parsed_date.isoformat(),
                expected_value=f"Valid accounting period date"
            ))

    return exceptions


def verify_monetary_basics(
    data: Dict[str, Any], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """Validates currency codes and non-zero/non-negative totals."""
    exceptions = []

    # Currency
    curr = str(data.get("currency") or "INR").strip().upper()
    if curr not in VALID_CURRENCIES and curr != "RS":
        exceptions.append(ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_INVALID_CURRENCY",
            field_name="currency",
            severity="low",
            title="Unrecognized Currency Code",
            explanation=f"Currency '{curr}' is not a standard recognized ISO monetary currency.",
            observed_value=curr,
            expected_value="Standard ISO currency (INR, USD, EUR, GBP, etc.)"
        ))

    # Total amount sanity
    total_val = data.get("grand_total")
    if total_val is None:
        total_val = data.get("total")
    if total_val is None:
        total_val = data.get("invoice_total")
    if total_val is not None:
        try:
            t = float(str(total_val).replace(",", "").replace("₹", "").strip())
            subtype = str(data.get("invoice_subtype") or "").lower()
            if t <= 0.0 and "credit_note" not in subtype:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=doc_id,
                    rule_id="RULE_NON_POSITIVE_AMOUNT",
                    field_name="grand_total",
                    severity="high",
                    title="Zero or Negative Total Amount",
                    explanation=f"Document has non-positive grand total amount (₹{t:,.2f}), which requires explicit CA review unless classified as a credit note/rebate.",
                    observed_value=f"₹{t:,.2f}",
                    expected_value="Positive total payable amount"
                ))
        except (ValueError, TypeError):
            pass

    return exceptions


def verify_required_fields(
    record_type: str, 
    data: Dict[str, Any], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """Checks for mandatory identifiers and party names depending on category."""
    exceptions: List[ValidationException] = []

    # Dates and monetary basics
    exceptions.extend(verify_dates_and_period(data, doc_id=doc_id, firm_id=firm_id))
    exceptions.extend(verify_monetary_basics(data, doc_id=doc_id, firm_id=firm_id))

    if record_type in ["invoices", "purchase_invoice", "sales_invoice", "purchase_records", "sales_records"]:
        inv_num = str(data.get("invoice_number") or data.get("bill_no") or data.get("identifier") or "").strip()
        if not inv_num or inv_num.lower() in ["none", "null", "unknown", "n/a", ""]:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_MISSING_INVOICE_NUMBER",
                field_name="invoice_number",
                severity="medium",
                title="Missing Invoice Number",
                explanation="Invoice identifier could not be detected from document text.",
                observed_value=None,
                expected_value="Alphanumeric invoice identifier (e.g. INV-1042)"
            ))

        party = str(data.get("vendor_name") or data.get("seller_name") or data.get("customer_name") or data.get("party_name") or "").strip()
        if not party or party.lower() in ["none", "null", "unknown", "n/a", ""]:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_MISSING_VENDOR_NAME",
                field_name="vendor_name",
                severity="medium",
                title="Unidentified Counterparty Name",
                explanation="Supplier or customer entity name was not detected.",
                observed_value=None,
                expected_value="Registered entity or trading business name"
            ))

    elif record_type in ["receipts", "expense_receipt"]:
        merchant = str(data.get("merchant_name") or data.get("vendor_name") or data.get("party_name") or "").strip()
        if not merchant or merchant.lower() in ["none", "null", "unknown", "n/a", ""]:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_MISSING_MERCHANT",
                field_name="merchant_name",
                severity="medium",
                title="Missing Merchant Name",
                explanation="Merchant or store establishment name could not be extracted from receipt.",
                observed_value=None,
                expected_value="Recognized merchant or establishment name"
            ))

    return exceptions


# ===========================================================================
# LAYER 2: ARITHMETIC VALIDATION (PAISE PRECISION)
# ===========================================================================

def verify_invoice_arithmetic(
    subtotal: float,
    cgst: float = 0.0,
    sgst: float = 0.0,
    igst: float = 0.0,
    tax_total: float = 0.0,
    round_off: float = 0.0,
    grand_total: float = 0.0,
    doc_id: str = "doc_default",
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """
    Validates Subtotal + Total Tax + Round-off == Grand Total and Tax component sums.
    """
    exceptions: List[ValidationException] = []
    try:
        sub_val = float(subtotal or 0.0)
        c_val = float(cgst or 0.0)
        s_val = float(sgst or 0.0)
        i_val = float(igst or 0.0)
        tax_val = float(tax_total or 0.0)
        ro_val = float(round_off or 0.0)
        gt_val = float(grand_total or 0.0)

        # Check 1: Tax Component Sum: CGST + SGST + IGST == Total Tax
        components_sum = round(c_val + s_val + i_val, 2)
        if components_sum > 0.0 and tax_val > 0.0:
            tax_variance = round(abs(tax_val - components_sum), 2)
            if tax_variance > ROUNDING_TOLERANCE:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=doc_id,
                    rule_id="RULE_TAX_SUM_MISMATCH",
                    field_name="total_tax",
                    severity="high",
                    title="GST Tax Components Sum Mismatch",
                    explanation=f"Sum of component taxes CGST (₹{c_val:,.2f}) + SGST (₹{s_val:,.2f}) + IGST (₹{i_val:,.2f}) equals ₹{components_sum:,.2f}, which differs from Total Tax ₹{tax_val:,.2f} by ₹{tax_variance:,.2f}.",
                    observed_value=f"₹{tax_val:,.2f}",
                    expected_value=f"₹{components_sum:,.2f}"
                ))

        if tax_val == 0.0 and components_sum > 0.0:
            tax_val = components_sum

        # Check 2: Missing Grand Total
        if gt_val <= 0.0 and (sub_val > 0.0 or tax_val > 0.0):
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_MISSING_TOTAL",
                field_name="grand_total",
                severity="high",
                title="Zero or Missing Grand Total",
                explanation="Document has line items or taxable amounts but Grand Total is zero or unreadable.",
                observed_value=f"₹{gt_val:,.2f}",
                expected_value="Positive total amount payable"
            ))
            return exceptions

        # Check 3: Subtotal + Tax + Round-off == Grand Total
        if gt_val > 0.0:
            expected_total = round(sub_val + tax_val + ro_val, 2)
            variance = round(abs(gt_val - expected_total), 2)

            if variance > ROUNDING_TOLERANCE:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=doc_id,
                    rule_id="RULE_MATH_TOTAL_MISMATCH",
                    field_name="grand_total",
                    severity="high",
                    title="Arithmetic Total Discrepancy",
                    explanation=f"Calculated sum of Subtotal (₹{sub_val:,.2f}) + Total Tax (₹{tax_val:,.2f}) + Round-off (₹{ro_val:,.2f}) is ₹{expected_total:,.2f}, which differs from printed Grand Total ₹{gt_val:,.2f} by ₹{variance:,.2f}.",
                    observed_value=f"₹{gt_val:,.2f}",
                    expected_value=f"₹{expected_total:,.2f}"
                ))

    except (ValueError, TypeError) as e:
        exceptions.append(ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_NUMERIC_PARSE_ERROR",
            field_name="amounts",
            severity="high",
            title="Numeric Parse Error",
            explanation=f"Financial figures could not be parsed as decimal currency values: {str(e)}",
            observed_value=None,
            expected_value="Valid decimal monetary amounts"
        ))

    return exceptions


def verify_line_items_arithmetic(
    data: Dict[str, Any], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """Verifies line items sum to subtotal and unit price × qty equals amount."""
    exceptions: List[ValidationException] = []
    line_items = data.get("line_items") or []
    if not isinstance(line_items, list) or len(line_items) == 0:
        return exceptions

    line_subtotal_sum = 0.0
    for idx, item in enumerate(line_items):
        if not isinstance(item, dict):
            continue
        try:
            qty = float(item.get("quantity") or item.get("qty") or 1.0)
            rate = float(item.get("unit_price") or item.get("rate") or 0.0)
            amount = float(item.get("amount") or 0.0)

            line_subtotal_sum += amount

            # Qty * Rate == Amount
            if qty > 0 and rate > 0 and amount > 0:
                expected_amt = round(qty * rate, 2)
                variance = round(abs(amount - expected_amt), 2)
                if variance > ROUNDING_TOLERANCE:
                    exceptions.append(ValidationException(
                        firm_id=firm_id,
                        document_id=doc_id,
                        rule_id="RULE_LINE_ITEM_QTY_RATE_MISMATCH",
                        field_name=f"line_items[{idx}].amount",
                        severity="medium",
                        title=f"Line Item #{idx + 1} Calculation Discrepancy",
                        explanation=f"Line item '{item.get('description', '')}' Qty ({qty}) × Unit Price (₹{rate:,.2f}) equals ₹{expected_amt:,.2f}, but line amount is ₹{amount:,.2f}.",
                        observed_value=f"₹{amount:,.2f}",
                        expected_value=f"₹{expected_amt:,.2f}"
                    ))
        except (ValueError, TypeError):
            continue

    # Sum of line items == Subtotal
    try:
        subtotal = float(data.get("subtotal") or 0.0)
        if subtotal > 0 and line_subtotal_sum > 0:
            diff = round(abs(subtotal - line_subtotal_sum), 2)
            if diff > ROUNDING_TOLERANCE:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=doc_id,
                    rule_id="RULE_LINE_ITEMS_SUBTOTAL_MISMATCH",
                    field_name="subtotal",
                    severity="high",
                    title="Sum of Line Items Does Not Match Subtotal",
                    explanation=f"Sum of {len(line_items)} line items is ₹{line_subtotal_sum:,.2f}, but document header Subtotal states ₹{subtotal:,.2f} (variance: ₹{diff:,.2f}).",
                    observed_value=f"₹{line_subtotal_sum:,.2f}",
                    expected_value=f"₹{subtotal:,.2f}"
                ))
    except (ValueError, TypeError):
        pass

    return exceptions


# ===========================================================================
# LAYER 3: TAX CONSISTENCY CHECKS
# ===========================================================================

def verify_tax_consistency(
    data: Dict[str, Any], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """
    Accounting-aware statutory checks:
    - CGST and SGST must have equal values/rates.
    - CGST/SGST and IGST should not appear together.
    - Intra-state (same state code) should use CGST + SGST.
    - Inter-state (different state code) should use IGST.
    - Tax charged without a seller GSTIN.
    """
    exceptions: List[ValidationException] = []

    cgst = float(data.get("cgst") or 0.0)
    sgst = float(data.get("sgst") or 0.0)
    igst = float(data.get("igst") or 0.0)
    tax_total = float(data.get("tax_total") or data.get("tax") or 0.0)

    # 1. CGST and SGST equality
    if cgst > 0.0 and sgst > 0.0:
        if abs(cgst - sgst) > ROUNDING_TOLERANCE:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_CGST_SGST_RATE_MISMATCH",
                field_name="tax",
                severity="medium",
                title="CGST & SGST Amount Discrepancy",
                explanation=f"Under GST statutory rules, Central GST (₹{cgst:,.2f}) and State GST (₹{sgst:,.2f}) must be identical for intra-state transactions.",
                observed_value=f"CGST: ₹{cgst:,.2f}, SGST: ₹{sgst:,.2f}",
                expected_value="Equal CGST and SGST amounts"
            ))

    # 2. Mutually exclusive taxes: CGST/SGST vs IGST
    if (cgst > 0.0 or sgst > 0.0) and igst > 0.0:
        exceptions.append(ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_MUTUALLY_EXCLUSIVE_TAXES",
            field_name="tax",
            severity="high",
            title="Conflicting GST Tax Regimes (CGST + IGST)",
            explanation="Document concurrently charges both Intra-state taxes (CGST/SGST) and Inter-state Integrated tax (IGST). These regimes are mutually exclusive.",
            observed_value=f"CGST: ₹{cgst:,.2f}, SGST: ₹{sgst:,.2f}, IGST: ₹{igst:,.2f}",
            expected_value="Either CGST + SGST (intra-state) OR IGST (inter-state)"
        ))

    # 3. Tax charged without Seller GSTIN
    seller_gstin = data.get("seller_gstin") or data.get("vendor_gstin") or data.get("party_tax_id")
    has_tax = (cgst > 0 or sgst > 0 or igst > 0 or tax_total > 0)
    if has_tax and (not seller_gstin or str(seller_gstin).strip().lower() in ["none", "null", "unknown", "n/a", ""]):
        exceptions.append(ValidationException(
            firm_id=firm_id,
            document_id=doc_id,
            rule_id="RULE_TAX_WITHOUT_GSTIN",
            field_name="seller_gstin",
            severity="high",
            title="GST Tax Charged Without Seller GSTIN",
            explanation=f"Document charges ₹{tax_total:,.2f} in tax, but no seller GSTIN is present. Businesses cannot claim Input Tax Credit (ITC) without seller GSTIN.",
            observed_value="GST charged without GSTIN",
            expected_value="Valid 15-character supplier GSTIN"
        ))

    # 4. Intra-state vs Inter-state supply rules
    buyer_gstin = data.get("buyer_gstin") or data.get("customer_gstin")
    pos = str(data.get("place_of_supply") or "").strip()

    if seller_gstin and len(str(seller_gstin)) >= 2:
        s_state = str(seller_gstin)[:2]
        b_state = str(buyer_gstin)[:2] if (buyer_gstin and len(str(buyer_gstin)) >= 2) else None

        # Intra-state transaction using IGST
        if b_state and s_state == b_state and igst > 0.0 and cgst == 0.0:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_INTRA_STATE_TAX_MISMATCH",
                field_name="igst",
                severity="medium",
                title="Intra-State Supply Charged With IGST",
                explanation=f"Supplier and Buyer are both in state '{s_state}', indicating an intra-state supply that should normally attract CGST + SGST instead of IGST (₹{igst:,.2f}).",
                observed_value=f"IGST ₹{igst:,.2f}",
                expected_value="CGST + SGST for intra-state supply"
            ))

        # Inter-state transaction using CGST + SGST
        elif b_state and s_state != b_state and (cgst > 0.0 or sgst > 0.0) and igst == 0.0:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_INTER_STATE_TAX_MISMATCH",
                field_name="cgst",
                severity="medium",
                title="Inter-State Supply Charged With Intra-State CGST/SGST",
                explanation=f"Supplier state '{s_state}' differs from Buyer state '{b_state}', which constitutes inter-state supply requiring Integrated GST (IGST) rather than local CGST/SGST.",
                observed_value=f"CGST ₹{cgst:,.2f} + SGST ₹{sgst:,.2f}",
                expected_value="IGST for inter-state supply"
            ))

    return exceptions


# ===========================================================================
# LAYER 7: BANK STATEMENT INTEGRITY
# ===========================================================================

def verify_statement_integrity(
    data: Dict[str, Any], 
    doc_id: str = "doc_default", 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """
    Validates:
    - Opening balance + Credits − Debits == Closing balance
    - Row-by-row running balance continuity
    - Chronological transaction date sequencing
    """
    exceptions: List[ValidationException] = []

    opening = float(data.get("opening_balance") or 0.0)
    closing = float(data.get("closing_balance") or 0.0)
    txns = data.get("transactions") or []

    if not isinstance(txns, list) or len(txns) == 0:
        return exceptions

    total_debits = 0.0
    total_credits = 0.0
    prev_balance = opening
    prev_date = None

    for idx, txn in enumerate(txns):
        if not isinstance(txn, dict):
            continue
        try:
            debit = float(txn.get("debit") or txn.get("withdrawal") or 0.0)
            credit = float(txn.get("credit") or txn.get("deposit") or 0.0)
            balance = float(txn.get("balance") or 0.0)

            total_debits += debit
            total_credits += credit

            # Row-by-row balance continuity
            expected_current = round(prev_balance + credit - debit, 2)
            if balance > 0 and abs(balance - expected_current) > ROUNDING_TOLERANCE:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=doc_id,
                    rule_id="RULE_RUNNING_BALANCE_DISCONTINUITY",
                    field_name=f"transactions[{idx}].balance",
                    severity="high",
                    title=f"Statement Row #{idx + 1} Balance Continuity Error",
                    explanation=f"Previous balance (₹{prev_balance:,.2f}) + Credit (₹{credit:,.2f}) − Debit (₹{debit:,.2f}) equals ₹{expected_current:,.2f}, but transaction states ₹{balance:,.2f}.",
                    observed_value=f"₹{balance:,.2f}",
                    expected_value=f"₹{expected_current:,.2f}"
                ))

            prev_balance = balance if balance > 0 else expected_current

            # Date sequence check
            d_str = txn.get("date") or txn.get("txn_date")
            if d_str:
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                    try:
                        curr_date = datetime.strptime(str(d_str).strip(), fmt).date()
                        if prev_date and curr_date < prev_date:
                            exceptions.append(ValidationException(
                                firm_id=firm_id,
                                document_id=doc_id,
                                rule_id="RULE_STATEMENT_DATE_ORDER",
                                field_name=f"transactions[{idx}].date",
                                severity="low",
                                title="Bank Transaction Date Out of Sequence",
                                explanation=f"Transaction #{idx + 1} dated {curr_date.isoformat()} precedes prior transaction dated {prev_date.isoformat()}.",
                                observed_value=curr_date.isoformat(),
                                expected_value=f"Date >= {prev_date.isoformat()}"
                            ))
                        prev_date = curr_date
                        break
                    except ValueError:
                        pass

        except (ValueError, TypeError):
            continue

    # Global Statement Balance: Opening + Credits − Debits == Closing
    if closing > 0 and (total_debits > 0 or total_credits > 0):
        expected_closing = round(opening + total_credits - total_debits, 2)
        variance = round(abs(closing - expected_closing), 2)
        if variance > ROUNDING_TOLERANCE:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_STATEMENT_BALANCE_DISCREPANCY",
                field_name="closing_balance",
                severity="high",
                title="Bank Statement Balance Discrepancy",
                explanation=f"Opening Balance (₹{opening:,.2f}) + Total Credits (₹{total_credits:,.2f}) − Total Debits (₹{total_debits:,.2f}) equals ₹{expected_closing:,.2f}, which differs from Closing Balance ₹{closing:,.2f} by ₹{variance:,.2f}.",
                observed_value=f"₹{closing:,.2f}",
                expected_value=f"₹{expected_closing:,.2f}"
            ))

    return exceptions


# ===========================================================================
# ORCHESTRATED VALIDATION PIPELINE
# ===========================================================================

def _validate_invoice(doc_id: str, firm_id: str, data: Dict[str, Any]) -> List[ValidationException]:
    exceptions: List[ValidationException] = []

    # Layer 1: Required fields, dates, monetary basics
    exceptions.extend(verify_required_fields("invoices", data, doc_id=doc_id, firm_id=firm_id))

    # Layer 1: GSTIN statutory validation
    gst_exc = verify_gstin(data.get("seller_gstin") or data.get("vendor_gstin") or data.get("gstin"), doc_id=doc_id, firm_id=firm_id)
    if gst_exc:
        exceptions.append(gst_exc)

    buyer_gst = data.get("buyer_gstin") or data.get("customer_gstin")
    if buyer_gst:
        b_exc = verify_gstin(buyer_gst, doc_id=doc_id, firm_id=firm_id)
        if b_exc:
            b_exc.field_name = "buyer_gstin"
            exceptions.append(b_exc)

    # Layer 2: Arithmetic verification
    subtotal = data.get("subtotal") or 0.0
    cgst = data.get("cgst") or 0.0
    sgst = data.get("sgst") or 0.0
    igst = data.get("igst") or 0.0
    tax_total = data.get("tax_total") or data.get("tax") or 0.0
    round_off = data.get("round_off") or 0.0
    grand_total = data.get("grand_total") or data.get("total") or 0.0

    exceptions.extend(verify_invoice_arithmetic(
        subtotal=subtotal,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        tax_total=tax_total,
        round_off=round_off,
        grand_total=grand_total,
        doc_id=doc_id,
        firm_id=firm_id
    ))

    # Layer 2: Line items arithmetic
    exceptions.extend(verify_line_items_arithmetic(data, doc_id=doc_id, firm_id=firm_id))

    # Layer 3: Tax consistency checks
    exceptions.extend(verify_tax_consistency(data, doc_id=doc_id, firm_id=firm_id))

    return exceptions


def _validate_receipt(doc_id: str, firm_id: str, data: Dict[str, Any]) -> List[ValidationException]:
    exceptions = []
    exceptions.extend(verify_required_fields("expense_receipt", data, doc_id=doc_id, firm_id=firm_id))

    try:
        subtotal = float(data.get("subtotal") or 0.0)
        tax = float(data.get("tax") or data.get("tax_total") or 0.0)
        grand_total = float(data.get("grand_total") or data.get("total") or 0.0)

        if grand_total <= 0.0:
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=doc_id,
                rule_id="RULE_MISSING_TOTAL",
                field_name="grand_total",
                severity="high",
                title="Missing Receipt Total",
                explanation="Receipt does not contain a recognizable non-zero total payment amount.",
                observed_value=f"₹{grand_total:,.2f}",
                expected_value="Positive total paid amount"
            ))
        elif subtotal > 0 and tax > 0:
            expected = round(subtotal + tax, 2)
            if abs(grand_total - expected) > ROUNDING_TOLERANCE:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=doc_id,
                    rule_id="RULE_RECEIPT_MATH_MISMATCH",
                    field_name="grand_total",
                    severity="high",
                    title="Receipt Subtotal + Tax Mismatch",
                    explanation=f"Receipt Subtotal (₹{subtotal:,.2f}) + Tax (₹{tax:,.2f}) equals ₹{expected:,.2f}, differing from Grand Total ₹{grand_total:,.2f}.",
                    observed_value=f"₹{grand_total:,.2f}",
                    expected_value=f"₹{expected:,.2f}"
                ))
    except (ValueError, TypeError):
        pass

    return exceptions


def _validate_payroll(doc_id: str, firm_id: str, data: Dict[str, Any]) -> List[ValidationException]:
    return verify_required_fields("payroll_roster", data, doc_id=doc_id, firm_id=firm_id)


def validate_extracted_data(
    doc_id: str,
    firm_id: str,
    doc_type: str,
    data: Dict[str, Any],
    db: Optional[Any] = None
) -> List[ValidationException]:
    """
    Runs deterministic multi-layer verification rules against extracted structured data.
    Never relies on LLM arithmetic.
    Returns list of ValidationException objects. If empty, document passed all rules.
    """
    exceptions: List[ValidationException] = []

    normalized_type = str(doc_type or "others").lower().strip()

    if normalized_type in ["invoices", "purchase_records", "sales_records", "purchase_invoice", "sales_invoice"]:
        exceptions.extend(_validate_invoice(doc_id, firm_id, data))

        # Layer 4: Cross-check against database for duplicate / conflicting invoices
        if db is not None:
            inv_num = str(data.get("invoice_number") or data.get("bill_no") or "").strip()
            total = float(data.get("grand_total") or data.get("total") or 0.0)
            if inv_num:
                from app.models.registers import Invoice
                existing_invoices = db.query(Invoice).filter(
                    Invoice.firm_id == firm_id,
                    Invoice.invoice_number == inv_num
                ).all()

                for existing in existing_invoices:
                    if existing.document_id == doc_id:
                        continue
                    existing_total = (existing.invoice_total_paise or 0) / 100.0
                    if total > 0 and existing_total > 0 and abs(total - existing_total) > ROUNDING_TOLERANCE:
                        exceptions.append(ValidationException(
                            firm_id=firm_id,
                            document_id=doc_id,
                            record_id=existing.id,
                            rule_id="RULE_SAME_INVOICE_CONFLICTING_TOTALS",
                            field_name="total",
                            severity="high",
                            title="Conflicting Totals for Same Invoice Number",
                            explanation=f"Invoice #{inv_num} is already recorded in the ledger with total ₹{existing_total:,.2f}, which contradicts the current total ₹{total:,.2f}.",
                            observed_value=f"₹{total:,.2f}",
                            expected_value=f"₹{existing_total:,.2f}"
                        ))
                    elif total > 0 and existing_total > 0 and abs(total - existing_total) <= ROUNDING_TOLERANCE:
                        exceptions.append(ValidationException(
                            firm_id=firm_id,
                            document_id=doc_id,
                            record_id=existing.id,
                            rule_id="RULE_DUPLICATE_INVOICE_NUMBER",
                            field_name="invoice_number",
                            severity="high",
                            title="Duplicate Invoice Detected",
                            explanation=f"Invoice #{inv_num} from '{existing.seller_name}' already exists in ledger register.",
                            observed_value=inv_num,
                            expected_value="Unique invoice number"
                        ))

    elif normalized_type in ["receipts", "expense_receipt"]:
        exceptions.extend(_validate_receipt(doc_id, firm_id, data))
    elif normalized_type in ["payroll_roster", "payroll_register"]:
        exceptions.extend(_validate_payroll(doc_id, firm_id, data))
    elif normalized_type in ["bank_statements", "bank_statement"]:
        exceptions.extend(verify_statement_integrity(data, doc_id=doc_id, firm_id=firm_id))
    elif normalized_type == "others":
        exceptions.extend(verify_monetary_basics(data, doc_id=doc_id, firm_id=firm_id))

    return exceptions


# ===========================================================================
# LAYER 4: DUPLICATE AND SEQUENCE CHECKS
# ===========================================================================

def _extract_doc_fingerprint(doc_or_data: Any) -> Dict[str, Any]:
    """Extracts comparable financial fingerprint fields from a document model or extracted_data dict."""
    if hasattr(doc_or_data, "extracted_data"):
        data = doc_or_data.extracted_data or {}
        filename = getattr(doc_or_data, "original_filename", "")
        doc_id = getattr(doc_or_data, "id", "")
        file_hash = getattr(doc_or_data, "file_hash", "")
    elif isinstance(doc_or_data, dict):
        data = doc_or_data.get("extracted_data") if "extracted_data" in doc_or_data else doc_or_data
        filename = doc_or_data.get("original_filename", doc_or_data.get("filename", ""))
        doc_id = doc_or_data.get("id", "")
        file_hash = doc_or_data.get("file_hash", "")
    else:
        data = {}
        filename = ""
        doc_id = ""
        file_hash = ""

    inv_no = str(data.get("invoice_number") or data.get("po_number") or data.get("bill_no") or "").strip().lower()
    if inv_no in ["none", "null", "unknown", "n/a", ""]:
        inv_no = ""

    party = str(data.get("party_name") or data.get("vendor_name") or data.get("vendor") or data.get("buyer_name") or data.get("customer_name") or "").strip().lower()
    if party in ["none", "null", "unknown", "n/a", ""]:
        party = ""

    date_val = str(data.get("invoice_date") or data.get("po_date") or data.get("date") or "").strip().lower()
    if date_val in ["none", "null", "unknown", "n/a", ""]:
        date_val = ""

    try:
        total = round(float(data.get("grand_total") or data.get("total") or 0.0), 2)
    except (ValueError, TypeError):
        total = 0.0

    return {
        "id": doc_id,
        "filename": filename,
        "file_hash": file_hash,
        "inv_no": inv_no,
        "party": party,
        "date": date_val,
        "total": total,
        "raw_data": data
    }


def detect_cross_file_duplicates(
    current_doc_id: str,
    current_filename: str,
    current_hash: str,
    current_data: Dict[str, Any],
    existing_docs: List[Any],
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """
    Evaluates current document against all other existing documents in the ledger
    to detect exact, statutory, conflicting, or financial duplicates.
    """
    exceptions: List[ValidationException] = []
    curr_fp = _extract_doc_fingerprint({
        "id": current_doc_id,
        "filename": current_filename,
        "file_hash": current_hash,
        "extracted_data": current_data
    })

    for other in existing_docs:
        other_id = getattr(other, "id", "") if hasattr(other, "id") else other.get("id", "")
        if other_id and other_id == current_doc_id:
            continue

        other_fp = _extract_doc_fingerprint(other)
        match_reason = None
        is_conflicting_amount = False

        # 1. Exact Binary Content Match (SHA-256 hash match)
        if curr_fp["file_hash"] and other_fp["file_hash"] and curr_fp["file_hash"] == other_fp["file_hash"]:
            match_reason = f"Identical file content hash (SHA-256: {curr_fp['file_hash'][:8]}...)"

        # 2. Statutory Identifier Match (Same Invoice / PO #)
        elif curr_fp["inv_no"] and other_fp["inv_no"] and curr_fp["inv_no"] == other_fp["inv_no"]:
            # Same invoice number but DIFFERENT totals -> Conflicting version!
            if curr_fp["total"] > 0 and other_fp["total"] > 0 and abs(curr_fp["total"] - other_fp["total"]) > ROUNDING_TOLERANCE:
                is_conflicting_amount = True
                match_reason = f"Conflicting invoice total: Same Invoice #{curr_fp['inv_no']} has printed total ₹{curr_fp['total']:,.2f}, while '{other_fp['filename']}' has total ₹{other_fp['total']:,.2f}."
            elif curr_fp["party"] and other_fp["party"] and (curr_fp["party"] in other_fp["party"] or other_fp["party"] in curr_fp["party"]):
                match_reason = f"Identical identifier '{curr_fp['inv_no']}' and matching party '{curr_fp['party']}'"
            elif curr_fp["total"] > 0 and other_fp["total"] > 0 and abs(curr_fp["total"] - other_fp["total"]) <= ROUNDING_TOLERANCE:
                match_reason = f"Identical identifier '{curr_fp['inv_no']}' and grand total ₹{curr_fp['total']:,.2f}"
            elif len(curr_fp["inv_no"]) >= 5 and curr_fp["inv_no"] not in ["invoice", "bill", "receipt"]:
                match_reason = f"Identical unique reference identifier '{curr_fp['inv_no']}'"

        # 3. Financial Fingerprint Match (Same Vendor + Same Date + Same Non-Zero Total)
        elif (
            curr_fp["total"] > 0
            and other_fp["total"] > 0
            and abs(curr_fp["total"] - other_fp["total"]) <= ROUNDING_TOLERANCE
            and curr_fp["party"]
            and other_fp["party"]
            and (curr_fp["party"] in other_fp["party"] or other_fp["party"] in curr_fp["party"])
            and curr_fp["party"] not in ["vendor", "party", "supplier", "buyer"]
            and not (curr_fp["inv_no"] and other_fp["inv_no"] and curr_fp["inv_no"] != other_fp["inv_no"])
        ):
            if curr_fp["date"] and other_fp["date"] and curr_fp["date"] == other_fp["date"]:
                match_reason = f"Identical party ('{curr_fp['party']}'), date ('{curr_fp['date']}'), and total amount ₹{curr_fp['total']:,.2f}"
            elif not curr_fp["inv_no"] and not other_fp["inv_no"]:
                match_reason = f"Identical party ('{curr_fp['party']}') and grand total ₹{curr_fp['total']:,.2f}"

        # 4. Duplicate Filename with Identical Amount
        elif (
            curr_fp["filename"]
            and other_fp["filename"]
            and curr_fp["filename"].lower() == other_fp["filename"].lower()
            and curr_fp["total"] > 0
            and other_fp["total"] > 0
            and abs(curr_fp["total"] - other_fp["total"]) <= ROUNDING_TOLERANCE
        ):
            match_reason = f"Identical filename '{curr_fp['filename']}' and grand total ₹{curr_fp['total']:,.2f}"

        if match_reason:
            other_name = other_fp["filename"] or f"Document #{other_fp['id'][:8]}"
            rule_id = "RULE_CONFLICTING_TOTALS_SAME_INV" if is_conflicting_amount else "RULE_DUPLICATE_DOCUMENT"
            title = "Conflicting Totals for Same Invoice Number" if is_conflicting_amount else "Duplicate Document Detected"

            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=current_doc_id,
                rule_id=rule_id,
                field_name="document",
                severity="high",
                title=title,
                explanation=(
                    f"This document conflicts with '{other_name}'. "
                    f"Basis: {match_reason}. "
                    "Approving both risks distorted vendor liability, double disbursement, or record contradiction."
                ),
                observed_value=f"Matches {other_name}",
                expected_value="Unique non-duplicated financial transaction",
                details_json=json.dumps({
                    "suggested_action": f"Inspect primary document '{other_name}' or mark this copy as duplicate/void",
                    "matched_document": other_name
                })
            ))
            break

    return exceptions


def find_all_duplicate_groups(documents: List[Any]) -> Dict[str, Dict[str, Any]]:
    """
    Scans a collection of documents and returns duplicate mapping:
    {doc_id: {is_duplicate: bool, duplicate_of_id: str, duplicate_of_filename: str, match_reason: str, group_id: str, group_size: int}}
    """
    results: Dict[str, Dict[str, Any]] = {}
    fps = [_extract_doc_fingerprint(d) for d in documents]
    n = len(fps)

    # Initialize all as non-duplicate
    for fp in fps:
        results[fp["id"]] = {
            "is_duplicate": False,
            "duplicate_of_id": None,
            "duplicate_of_filename": None,
            "match_reason": None,
            "group_id": None,
            "group_size": 1
        }

    for i in range(n):
        for j in range(i + 1, n):
            fp_a = fps[i]
            fp_b = fps[j]
            match_reason = None

            # Hash match
            if fp_a["file_hash"] and fp_b["file_hash"] and fp_a["file_hash"] == fp_b["file_hash"]:
                match_reason = f"Identical file hash ({fp_a['file_hash'][:8]}...)"
            # ID match
            elif fp_a["inv_no"] and fp_b["inv_no"] and fp_a["inv_no"] == fp_b["inv_no"] and len(fp_a["inv_no"]) >= 4:
                match_reason = f"Matching PO/Invoice #{fp_a['inv_no']}"
            # Party + Amount match (only when invoice numbers don't conflict)
            elif (
                fp_a["total"] > 0
                and fp_b["total"] > 0
                and abs(fp_a["total"] - fp_b["total"]) <= ROUNDING_TOLERANCE
                and fp_a["party"]
                and fp_b["party"]
                and (fp_a["party"] in fp_b["party"] or fp_b["party"] in fp_a["party"])
                and not (fp_a["inv_no"] and fp_b["inv_no"] and fp_a["inv_no"] != fp_b["inv_no"])
            ):
                match_reason = f"Matching party '{fp_a['party']}' and total ₹{fp_a['total']:,.2f}"
            # Same filename and non-zero total
            elif (
                fp_a["filename"]
                and fp_b["filename"]
                and fp_a["filename"].lower() == fp_b["filename"].lower()
                and fp_a["total"] > 0
                and fp_b["total"] > 0
                and abs(fp_a["total"] - fp_b["total"]) <= ROUNDING_TOLERANCE
            ):
                match_reason = f"Identical filename '{fp_a['filename']}' and total ₹{fp_a['total']:,.2f}"

            if match_reason:
                results[fp_b["id"]] = {
                    "is_duplicate": True,
                    "duplicate_of_id": fp_a["id"],
                    "duplicate_of_filename": fp_a["filename"],
                    "match_reason": match_reason,
                    "group_id": fp_a["id"],
                    "group_size": results[fp_a["id"]]["group_size"] + 1
                }
                results[fp_a["id"]]["is_duplicate"] = True
                results[fp_a["id"]]["duplicate_of_id"] = fp_b["id"]
                results[fp_a["id"]]["duplicate_of_filename"] = fp_b["filename"]
                results[fp_a["id"]]["match_reason"] = f"Duplicate copy detected: '{fp_b['filename']}' ({match_reason})"
                results[fp_a["id"]]["group_size"] += 1

    return results
