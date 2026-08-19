import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const SETTING_KEY = 'expense_defaults';
export const QUERY_KEY = ['expense-defaults'];

/**
 * useExpenseDefaults — fetches the global expense category defaults stored
 * in the AppSetting entity (key: 'expense_defaults'). Returns a map of
 * category → { default_amount, vat_rate, unit, description }.
 *
 * Used by the staff expense entry flow to pre-fill new entries.
 */
export function useExpenseDefaults() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await base44.entities.AppSetting.filter({ key: SETTING_KEY });
      if (res.length > 0 && res[0].value) return res[0].value;
      return {};
    },
    staleTime: 60 * 1000,
  });
}

/**
 * useSaveExpenseDefaults — returns a mutation function that upserts the
 * global expense defaults. Invalidates the query cache on success.
 */
export function useSaveExpenseDefaults() {
  const queryClient = useQueryClient();
  return async (value) => {
    const existing = await base44.entities.AppSetting.filter({ key: SETTING_KEY });
    if (existing.length > 0) {
      await base44.entities.AppSetting.update(existing[0].id, { value, label: 'Expense Category Defaults' });
    } else {
      await base44.entities.AppSetting.create({ key: SETTING_KEY, label: 'Expense Category Defaults', value });
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };
}