import React, { createContext, useCallback, useContext, useState } from 'react';

type Currency = 'HKD' | 'USD' | 'JPY' | 'CNY';

// Exchange rates relative to USD
const RATES: Record<Currency, number> = {
  USD: 1,
  HKD: 7.8,
  JPY: 155,
  CNY: 7.2,
};

const SYMBOLS: Record<Currency, string> = {
  USD: 'US$',
  HKD: 'HK$',
  JPY: '¥',
  CNY: 'CN¥',
};

type CurrencyContextType = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Convert a USD price to the selected currency, returns a formatted string e.g. "HK$450" */
  convert: (usdPrice: number) => string;
  /** Raw conversion factor from USD → selected currency */
  rate: number;
  /** Currency symbol for inline composition (e.g. chart axis "HK$10k") */
  symbol: string;
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'HKD',
  setCurrency: () => {},
  convert: (p) => `HK$${(p * 7.8).toFixed(0)}`,
  rate: 7.8,
  symbol: 'HK$',
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('HKD');

  const rate = RATES[currency];

  const convert = useCallback(
    (usdPrice: number): string => {
      // Language-neutral fallback so EN/JA users don't get Chinese text.
      // Callers needing a localized "Price pending" string should i18n
      // themselves around `usdPrice <= 0`.
      if (usdPrice <= 0) return '—';
      const converted = usdPrice * rate;
      const symbol = SYMBOLS[currency];
      if (currency === 'JPY') {
        return `${symbol}${Math.round(converted).toLocaleString()}`;
      }
      return `${symbol}${converted.toFixed(0)}`;
    },
    [currency, rate]
  );

  const symbol = SYMBOLS[currency];

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convert, rate, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
