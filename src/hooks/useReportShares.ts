import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReportShare {
  id: string;
  token: string;
  project_id: string;
  report_type: string;
  report_label: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  view_count: number;
  label: string | null;
}

export type ReportType = 'executive' | 'planejamento' | 'cronograma-geral';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  executive: 'Relatório Executivo',
  planejamento: 'Planejamento HTML',
  'cronograma-geral': 'Cronograma Geral',
};

export function useReportShares(projectId?: string) {
  const [shares, setShares] = useState<ReportShare[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchShares = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('report_shares')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShares(data || []);
    } catch (e: any) {
      console.error('Failed to fetch report shares:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const createShare = async (
    html: string,
    reportType: ReportType,
    label?: string
  ): Promise<ReportShare | null> => {
    if (!projectId) return null;
    try {
      const { data, error } = await (supabase as any)
        .from('report_shares')
        .insert({
          project_id: projectId,
          report_type: reportType,
          report_label: REPORT_TYPE_LABELS[reportType],
          html_content: html,
          expires_at: null, // permanent until revoked
          label: label || null,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchShares();
      return data;
    } catch (e: any) {
      toast.error('Erro ao gerar link de compartilhamento.');
      console.error(e);
      return null;
    }
  };

  const revokeShare = async (shareId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('report_shares')
        .update({ is_active: false })
        .eq('id', shareId);

      if (error) throw error;
      toast.success('Link revogado com sucesso. O cliente não conseguirá mais acessar.');
      await fetchShares();
    } catch (e: any) {
      toast.error('Erro ao revogar link.');
      console.error(e);
    }
  };

  const reactivateShare = async (shareId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('report_shares')
        .update({ is_active: true })
        .eq('id', shareId);

      if (error) throw error;
      toast.success('Link reativado.');
      await fetchShares();
    } catch (e: any) {
      toast.error('Erro ao reativar link.');
      console.error(e);
    }
  };

  return {
    shares,
    loading,
    createShare,
    revokeShare,
    reactivateShare,
    refetch: fetchShares,
  };
}

/** Fetch a single share by token (no auth required) */
export async function fetchShareByToken(token: string): Promise<ReportShare & { html_content: string } | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('report_shares')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    // Increment view count
    await (supabase as any)
      .from('report_shares')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);

    return data;
  } catch (e) {
    return null;
  }
}
