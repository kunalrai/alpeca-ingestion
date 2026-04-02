const axios = require('axios');
const config = require('./config');

const client = axios.create({
  baseURL: config.polygon.baseUrl,
  timeout: 15000,
});

// Polygon uses query-param auth
function authParams() {
  return { apiKey: config.polygon.apiKey };
}

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? n : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTickerDetails(symbol) {
  const res = await client.get(`/v3/reference/tickers/${symbol}`, { params: authParams() });
  return res.data.results ?? null;
}

async function fetchFinancials(symbol) {
  const res = await client.get('/vX/reference/financials', {
    params: { ...authParams(), ticker: symbol, timeframe: 'annual', limit: 1 },
  });
  return res.data.results?.[0] ?? null;
}

async function fetchDividends(symbol) {
  const res = await client.get('/v3/reference/dividends', {
    params: { ...authParams(), ticker: symbol, limit: 1, order: 'desc' },
  });
  return res.data.results?.[0] ?? null;
}

/**
 * Map Polygon API responses → fundamentals DB row (Polygon-owned columns only).
 * Does not overwrite Alpaca-owned columns (current_price, bid, ask, volume, etc.).
 */
function polygonToFundamentalsRow(symbol, details, financials, dividends, currentPrice) {
  const fin = financials?.financials ?? null;
  const IS  = fin?.income_statement ?? {};
  const BS  = fin?.balance_sheet ?? {};
  const CF  = fin?.cash_flow_statement ?? {};

  // ── Company info ─────────────────────────────────────────────────────────────
  const long_name             = details?.name ?? null;
  const long_business_summary = details?.description ?? null;
  const market_cap            = num(details?.market_cap);
  const shares_outstanding    = num(details?.share_class_shares_outstanding);
  const float_shares          = num(details?.weighted_shares_outstanding);
  const industry              = details?.sic_description ?? null;
  const full_time_employees   = details?.total_employees ? parseInt(details.total_employees) : null;
  const website               = details?.homepage_url ?? null;

  // ── Financials ───────────────────────────────────────────────────────────────
  const totalrevenue        = num(IS.revenues?.value);
  const netincometocommon   = num(IS.net_income_loss?.value);
  const gross_profit        = num(IS.gross_profit?.value);
  const operating_income    = num(IS.operating_income_loss?.value);
  const ebit                = num(IS.ebit?.value);
  const da                  = num(CF.depreciation_and_amortization?.value);
  const ebitda              = ebit != null && da != null ? ebit + Math.abs(da) : (ebit ?? null);
  const eps                 = num(IS.basic_earnings_per_share?.value);
  const trailing_eps        = eps;
  const eps_current_year    = num(IS.diluted_earnings_per_share?.value);

  const total_cash          = num(BS.cash?.value ?? BS.cash_and_cash_equivalents?.value);
  const current_assets      = num(BS.current_assets?.value);
  const current_liabilities = num(BS.current_liabilities?.value);
  const total_assets        = num(BS.assets?.value);
  const equity              = num(BS.equity?.value);
  const long_term_debt      = num(BS.long_term_debt?.value ?? BS.long_term_debt_and_capital_lease_obligations?.value);
  const total_debt          = long_term_debt != null && current_liabilities != null
    ? long_term_debt + current_liabilities
    : (long_term_debt ?? null);
  const inventory           = num(BS.inventory?.value);

  const operating_cashflow  = num(CF.net_cash_flow_from_operating_activities?.value);
  const capex               = num(CF.capital_expenditure?.value);
  const free_cashflow       = operating_cashflow != null && capex != null
    ? operating_cashflow + capex  // capex is typically negative
    : (operating_cashflow ?? null);

  // ── Derived ratios ───────────────────────────────────────────────────────────
  const book_value          = equity != null && shares_outstanding ? num(equity / shares_outstanding) : null;
  const revenue_per_share   = totalrevenue != null && shares_outstanding ? num(totalrevenue / shares_outstanding) : null;
  const total_cash_per_share = total_cash != null && shares_outstanding ? num(total_cash / shares_outstanding) : null;
  const enterprise_value    = market_cap != null && total_debt != null && total_cash != null
    ? num(market_cap + total_debt - total_cash)
    : null;

  const profit_margins      = totalrevenue && netincometocommon != null ? num(netincometocommon / totalrevenue) : null;
  const gross_margins       = totalrevenue && gross_profit != null ? num(gross_profit / totalrevenue) : null;
  const operating_margins   = totalrevenue && operating_income != null ? num(operating_income / totalrevenue) : null;
  const ebitda_margins      = totalrevenue && ebitda != null ? num(ebitda / totalrevenue) : null;
  const return_on_assets    = total_assets && netincometocommon != null ? num(netincometocommon / total_assets) : null;
  const return_on_equity    = equity && netincometocommon != null ? num(netincometocommon / equity) : null;
  const debt_to_equity      = equity && total_debt != null ? num(total_debt / equity) : null;
  const current_ratio       = current_assets != null && current_liabilities ? num(current_assets / current_liabilities) : null;
  const quick_ratio         = current_assets != null && inventory != null && current_liabilities
    ? num((current_assets - inventory) / current_liabilities)
    : null;

  const price = num(currentPrice);
  const trailing_pe    = price && trailing_eps ? num(price / trailing_eps) : null;
  const price_to_book  = price && book_value ? num(price / book_value) : null;
  const price_to_sales = market_cap != null && totalrevenue ? num(market_cap / totalrevenue) : null;

  // ── Dividends ────────────────────────────────────────────────────────────────
  let dividend_rate = null;
  let trailing_annual_dividend_rate = null;
  let last_dividend_value = null;
  let ex_dividend_date = null;
  let dividend_date = null;
  let dividend_yield = null;
  let payout_ratio = null;

  if (dividends) {
    const freq = num(dividends.frequency) || 1;
    last_dividend_value = num(dividends.cash_amount);
    dividend_rate = last_dividend_value != null ? num(last_dividend_value * freq) : null;
    trailing_annual_dividend_rate = dividend_rate;
    ex_dividend_date = dividends.ex_dividend_date ? new Date(dividends.ex_dividend_date) : null;
    dividend_date = dividends.pay_date ? new Date(dividends.pay_date) : null;
    dividend_yield = dividend_rate != null && price ? num(dividend_rate / price) : null;
    payout_ratio = dividend_rate != null && eps ? num(dividend_rate / eps) : null;
  }

  return {
    symbol,
    // Company
    long_name, long_business_summary, industry, full_time_employees, website,
    // Shares
    market_cap, shares_outstanding, float_shares,
    // Valuation
    enterprise_value, book_value, price_to_book, price_to_sales, trailing_pe,
    // Financials
    totalrevenue, netincometocommon, ebitda, free_cashflow, operating_cashflow,
    total_cash, total_cash_per_share, total_debt,
    profit_margins, gross_margins, ebitda_margins, operating_margins,
    return_on_assets, return_on_equity,
    current_ratio, quick_ratio, debt_to_equity,
    revenue_per_share,
    // EPS
    eps, trailing_eps, eps_current_year,
    // Dividends
    dividend_rate, trailing_annual_dividend_rate, last_dividend_value,
    ex_dividend_date, dividend_date, dividend_yield, payout_ratio,
  };
}

module.exports = { fetchTickerDetails, fetchFinancials, fetchDividends, polygonToFundamentalsRow, sleep };
