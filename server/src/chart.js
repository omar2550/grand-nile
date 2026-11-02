// Standard list of accounts created for every hotel. [code, name, type, parent, isGroup]
export const CHART = [
  ['1000', 'Assets (what the hotel owns)', 'asset', null, true], ['1100', 'Cash, bank and guest bills', 'asset', '1000', true],
  ['1110', 'Cash – Reception', 'asset', '1100'], ['1115', 'Cash – Restaurant', 'asset', '1100'], ['1116', 'Cash – Rooftop', 'asset', '1100'],
  ['1120', 'Bank account', 'asset', '1100'], ['1130', "Guests' open bills (owed to us)", 'asset', '1100'],
  ['1140', 'Stock – Food & drinks', 'asset', '1100'], ['1150', 'Stock – Cleaning & room supplies', 'asset', '1100'],
  ['1200', 'Fixed assets', 'asset', '1000', true], ['1210', 'Building, furniture & equipment', 'asset', '1200'],
  ['2000', 'Liabilities (what the hotel owes)', 'liability', null, true], ['2100', 'Suppliers & companies we owe', 'liability', '2000'],
  ['2110', 'VAT collected (14%) – to pay the tax office', 'liability', '2000'], ['2120', 'Service charge collected (12%) – for staff', 'liability', '2000'],
  ['3000', 'Owners’ money', 'equity', null, true], ['3100', 'Owners’ capital', 'equity', '3000'],
  ['4000', 'Income (sales)', 'revenue', null, true], ['4100', 'Room income', 'revenue', '4000'], ['4200', 'Restaurant & room-service income', 'revenue', '4000'],
  ['4210', 'Rooftop income', 'revenue', '4000'], ['4300', 'Other income (minibar, laundry, spa)', 'revenue', '4000'],
  ['4400', 'Tours income', 'revenue', '4000'], ['4410', 'Airport ride income', 'revenue', '4000'],
  ['5000', 'Direct costs', 'expense', null, true], ['5100', 'Cost of food & drinks sold', 'expense', '5000'],
  ['5200', 'Tour company costs', 'expense', '5000'], ['5210', 'Transport costs (cars & drivers)', 'expense', '5000'],
  ['6000', 'Running expenses', 'expense', null, true], ['6100', 'Salaries & wages', 'expense', '6000'], ['6200', 'Electricity, water & gas', 'expense', '6000'],
  ['6300', 'Repairs & maintenance', 'expense', '6000'], ['6400', 'Cleaning & room supplies used', 'expense', '6000'],
  ['6500', 'Marketing & booking-site commissions', 'expense', '6000'], ['6600', 'Other expenses', 'expense', '6000'],
].map(([code, name, type, parent, isGroup]) => ({ code, name, type, parent, isGroup: !!isGroup }));
export const CASH_CODES = ['1110', '1115', '1116'];
