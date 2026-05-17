import { supabase } from './supabase';

type SearchCardsParams = {
  q: string;
  pageSize?: number;
  orderBy?: string;
};

export async function searchCards(
  params: SearchCardsParams
): Promise<{ data: any[] } | null> {
  const { data, error } = await supabase.functions.invoke('pokemontcg-proxy', {
    body: { op: 'searchCards', ...params },
  });
  if (error) {
    console.error('searchCards', error);
    return null;
  }
  return data as { data: any[] };
}

export async function getCard(
  id: string
): Promise<{ data: any } | null> {
  const { data, error } = await supabase.functions.invoke('pokemontcg-proxy', {
    body: { op: 'getCard', id },
  });
  if (error) {
    console.error('getCard', error);
    return null;
  }
  return data as { data: any };
}
