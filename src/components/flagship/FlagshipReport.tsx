import { useRef, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { GroupId, GroupData, PortfolioItem, GROUP_META, BASE_DATE_LABEL_KO, BASE_DATE_LABEL_EN } from './portfolioTypes';
import { buildReturnSeries, calcItemReturn, formatPct, calcExpectedGroupReturn } from './portfolioUtils';
import ReactMarkdown from 'react-markdown';

const GROUP_COLORS: Record<string, string> = {
  shares: '#b8860b',
  bonds: '#1a2744',
  others: '#22c55e',
  cash: '#9ca3af',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PortfolioItem[];
  groups: GroupData[];
  groupWeights: Record<GroupId, number>;
  aiAnalysis?: string;
}

export function FlagshipReport({ open, onOpenChange, items, groups, groupWeights, aiAnalysis }: Props) {
  const { language } = useLanguage();
  const ko = language === 'ko';
  const printRef = useRef<HTMLDivElement>(null);
  const [cioComment, setCioComment] = useState<{ content: string; date: string } | null>(null);

  useEffect(() => {
    if (open) {
      supabase
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', 'cio_commentary')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.value) {
            const val = data.value as any;
            const content = ko ? val.content_ko : val.content_en;
            const d = new Date(data.updated_at);
            const dateStr = ko
              ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
              : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            setCioComment(content ? { content, date: dateStr } : null);
          }
        });
    }
  }, [open, ko]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Clone SVG charts as inline
    const clone = content.cloneNode(true) as HTMLElement;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${ko ? '남산 플래그십 리포트' : 'Namsan Flagship Report'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a2744; background: white; }
          .report-page { max-width: 210mm; margin: 0 auto; padding: 12mm 15mm; }
          .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b8860b; padding-bottom: 8px; margin-bottom: 12px; }
          .report-header h1 { font-size: 18px; font-weight: 700; color: #1a2744; }
          .report-header .date { font-size: 11px; color: #666; }
          .report-header .subtitle { font-size: 11px; color: #b8860b; letter-spacing: 2px; text-transform: uppercase; }
          .section-title { font-size: 13px; font-weight: 600; color: #1a2744; margin: 10px 0 6px; border-left: 3px solid #b8860b; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
          th { background: #f5f5f0; color: #1a2744; font-weight: 600; text-align: left; padding: 5px 8px; border-bottom: 1px solid #ddd; }
          td { padding: 4px 8px; border-bottom: 1px solid #eee; }
          .text-right { text-align: right; }
          .text-green { color: #16a34a; }
          .text-red { color: #dc2626; }
          .charts-row { display: flex; gap: 12px; margin-bottom: 10px; }
          .chart-box { flex: 1; border: 1px solid #eee; border-radius: 6px; padding: 8px; }
          .chart-box h4 { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
          .commentary { background: #faf9f5; border-left: 3px solid #b8860b; padding: 8px 12px; font-size: 10px; line-height: 1.5; font-style: italic; margin-bottom: 10px; border-radius: 0 4px 4px 0; }
          .commentary .date-label { font-size: 9px; color: #999; margin-bottom: 4px; }
          .ai-section { font-size: 10px; line-height: 1.5; margin-bottom: 10px; }
          .ai-section p { margin-bottom: 4px; }
          .ai-section ul, .ai-section ol { padding-left: 16px; margin: 4px 0; }
          .ai-section li { margin-bottom: 2px; }
          .disclaimer { font-size: 8px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 6px; margin-top: 10px; }
          .legend { display: flex; gap: 12px; justify-content: center; margin-top: 4px; font-size: 10px; }
          .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; vertical-align: middle; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .report-page { padding: 8mm 12mm; } }
          @page { size: A4; margin: 0; }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const today = new Date();
  const dateStr = ko
    ? `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`
    : today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const totalAllocation = groups.reduce((s, g) => s + g.totalWeight, 0);
  const totalPerformance = groups.reduce((s, g) => s + g.totalWeight * g.performance, 0) / (totalAllocation || 1);

  const pieData = groups
    .filter(g => (groupWeights[g.id] || 0) > 0)
    .map(g => ({
      name: ko ? g.nameKo : g.nameEn,
      value: groupWeights[g.id] || 0,
      color: GROUP_COLORS[g.id] || '#888',
    }));

  const lineSeries = buildReturnSeries(items, groupWeights);

  // Truncate AI analysis for one-page fit
  const truncatedAI = aiAnalysis
    ? aiAnalysis.length > 600
      ? aiAnalysis.slice(0, 600) + '...'
      : aiAnalysis
    : null;

  // Truncate CIO for one-page fit
  const truncatedCIO = cioComment?.content
    ? cioComment.content.length > 400
      ? cioComment.content.slice(0, 400) + '...'
      : cioComment.content
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-serif font-semibold text-sm">
            {ko ? '리포트 미리보기' : 'Report Preview'}
          </h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              {ko ? '인쇄 / PDF' : 'Print / PDF'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Report Content (print target) */}
        <div ref={printRef} className="report-page" style={{ maxWidth: '210mm', margin: '0 auto', padding: '12mm 15mm', background: 'white', color: '#1a2744' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #b8860b', paddingBottom: '8px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#b8860b', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Flagship Portfolio</div>
              <h1 style={{ fontSize: '18px', fontWeight: 700 }}>
                {ko ? 'Namsan Flagship 투자 리포트' : 'Namsan Flagship Investment Report'}
              </h1>
            </div>
            <div style={{ textAlign: 'right' as const, fontSize: '11px', color: '#666' }}>
              <div>{dateStr}</div>
              <div>{ko ? `기준일: ${BASE_DATE_LABEL_KO}` : `Base: ${BASE_DATE_LABEL_EN}`}</div>
            </div>
          </div>

          {/* Summary Table */}
          <div style={{ fontSize: '13px', fontWeight: 600, margin: '10px 0 6px', borderLeft: '3px solid #b8860b', paddingLeft: '8px' }}>
            {ko ? '포트폴리오 요약' : 'Portfolio Summary'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '11px', marginBottom: '10px' }}>
            <thead>
              <tr>
                <th style={{ background: '#f5f5f0', padding: '5px 8px', textAlign: 'left' as const, borderBottom: '1px solid #ddd' }}>{ko ? '그룹' : 'Group'}</th>
                <th style={{ background: '#f5f5f0', padding: '5px 8px', textAlign: 'right' as const, borderBottom: '1px solid #ddd' }}>{ko ? '배분' : 'Allocation'}</th>
                <th style={{ background: '#f5f5f0', padding: '5px 8px', textAlign: 'right' as const, borderBottom: '1px solid #ddd' }}>{ko ? '수익률' : 'Return'}</th>
                <th style={{ background: '#f5f5f0', padding: '5px 8px', textAlign: 'right' as const, borderBottom: '1px solid #ddd' }}>{ko ? '기대수익률(연)' : 'Exp. Return (Ann.)'}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const perf = g.performance;
                const expRet = calcExpectedGroupReturn(g);
                return (
                  <tr key={g.id}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{ko ? g.nameKo : g.nameEn}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' as const, fontFamily: 'monospace' }}>{g.totalWeight.toFixed(1)}%</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' as const, fontFamily: 'monospace', color: perf > 0 ? '#16a34a' : perf < 0 ? '#dc2626' : '#666' }}>{formatPct(perf)}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' as const, fontFamily: 'monospace' }}>{formatPct(expRet)}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 600, background: '#f9f9f5' }}>
                <td style={{ padding: '5px 8px', borderTop: '2px solid #ddd' }}>{ko ? '합계' : 'Total'}</td>
                <td style={{ padding: '5px 8px', borderTop: '2px solid #ddd', textAlign: 'right' as const, fontFamily: 'monospace' }}>{totalAllocation.toFixed(1)}%</td>
                <td style={{ padding: '5px 8px', borderTop: '2px solid #ddd', textAlign: 'right' as const, fontFamily: 'monospace', color: totalPerformance > 0 ? '#16a34a' : totalPerformance < 0 ? '#dc2626' : '#666' }}>{formatPct(totalPerformance)}</td>
                <td style={{ padding: '5px 8px', borderTop: '2px solid #ddd' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Charts */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
            {/* Pie */}
            <div style={{ flex: 1, border: '1px solid #eee', borderRadius: '6px', padding: '8px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>{ko ? '자산 배분' : 'Asset Allocation'}</h4>
              <div style={{ height: '140px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2} dataKey="value" label={({ value }) => `${value.toFixed(0)}%`} labelLine={false}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', fontSize: '10px', marginTop: '4px' }}>
                {pieData.map((d, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Line */}
            <div style={{ flex: 1, border: '1px solid #eee', borderRadius: '6px', padding: '8px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>{ko ? '수익률 추이' : 'Performance'}</h4>
              <div style={{ height: '140px' }}>
                {lineSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} width={35} />
                      <Line type="monotone" dataKey="value" stroke="#b8860b" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#999' }}>
                    {ko ? '데이터 없음' : 'No data'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CIO Commentary */}
          {truncatedCIO && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, margin: '10px 0 6px', borderLeft: '3px solid #b8860b', paddingLeft: '8px' }}>
                {ko ? 'CIO 코멘트' : 'CIO Commentary'}
              </div>
              <div style={{ background: '#faf9f5', borderLeft: '3px solid #b8860b', padding: '8px 12px', fontSize: '10px', lineHeight: 1.5, fontStyle: 'italic' as const, marginBottom: '10px', borderRadius: '0 4px 4px 0' }}>
                <div style={{ fontSize: '9px', color: '#999', marginBottom: '4px' }}>{cioComment?.date}</div>
                <div className="prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0">
                  <ReactMarkdown>{truncatedCIO}</ReactMarkdown>
                </div>
              </div>
            </>
          )}

          {/* AI Analysis */}
          {truncatedAI && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, margin: '10px 0 6px', borderLeft: '3px solid #b8860b', paddingLeft: '8px' }}>
                {ko ? 'AI 포트폴리오 분석' : 'AI Portfolio Analysis'}
              </div>
              <div style={{ fontSize: '10px', lineHeight: 1.5, marginBottom: '10px' }} className="prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0 [&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-xs [&_strong]:font-semibold">
                <ReactMarkdown>{truncatedAI}</ReactMarkdown>
              </div>
            </>
          )}

          {/* Disclaimer */}
          <div style={{ fontSize: '8px', color: '#999', textAlign: 'center' as const, borderTop: '1px solid #eee', paddingTop: '6px', marginTop: '10px' }}>
            {ko
              ? '본 리포트는 정보 제공 목적이며 투자 권유가 아닙니다. 과거 실적이 미래 수익을 보장하지 않습니다. © Namsan Partners'
              : 'This report is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. © Namsan Partners'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
