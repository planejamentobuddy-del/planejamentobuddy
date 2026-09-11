import React, { useState } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatNumber(val: number, dec: number = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

export function CurvaABCView() {
  const { abcAnalysis, bdiRate, viewMode } = useBudget();
  const [filterCategory, setFilterCategory] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [search, setSearch] = useState('');

  const multiplier = viewMode === 'selling' ? 1 + bdiRate / 100 : 1;

  const stats = React.useMemo(() => {
    let countA = 0;
    let totalA = 0;
    let countB = 0;
    let totalB = 0;
    let countC = 0;
    let totalC = 0;

    abcAnalysis.forEach(it => {
      const val = it.totalCost * multiplier;
      if (it.category === 'A') {
        countA++;
        totalA += val;
      } else if (it.category === 'B') {
        countB++;
        totalB += val;
      } else {
        countC++;
        totalC += val;
      }
    });

    const grandTotal = totalA + totalB + totalC;

    return {
      countA,
      totalA,
      pctA: grandTotal > 0 ? (totalA / grandTotal) * 100 : 0,
      countB,
      totalB,
      pctB: grandTotal > 0 ? (totalB / grandTotal) * 100 : 0,
      countC,
      totalC,
      pctC: grandTotal > 0 ? (totalC / grandTotal) * 100 : 0,
      grandTotal,
    };
  }, [abcAnalysis, multiplier]);

  const filteredItems = abcAnalysis.filter(it => {
    const matchCat = filterCategory === 'all' || it.category === filterCategory;
    const matchSearch =
      !search ||
      it.description.toLowerCase().includes(search.toLowerCase()) ||
      it.code.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          onClick={() => setFilterCategory(filterCategory === 'A' ? 'all' : 'A')}
          className={`cursor-pointer transition-all border-l-4 border-l-rose-500 hover:shadow-md ${
            filterCategory === 'A' ? 'ring-2 ring-rose-500' : ''
          }`}
        >
          <CardHeader className="p-4 pb-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400">
                Classe A (Prioridade Máxima)
              </span>
              <span className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold px-2 py-0.5 rounded-full border border-rose-500/30">
                {stats.countA} itens
              </span>
            </div>
            <CardTitle className="text-xl font-bold font-display pt-1">
              {formatCurrency(stats.totalA)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Representa <strong>{formatPercent(stats.pctA, 1)}</strong> do custo da obra. Negociação prioritária!
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilterCategory(filterCategory === 'B' ? 'all' : 'B')}
          className={`cursor-pointer transition-all border-l-4 border-l-amber-500 hover:shadow-md ${
            filterCategory === 'B' ? 'ring-2 ring-amber-500' : ''
          }`}
        >
          <CardHeader className="p-4 pb-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                Classe B (Intermediária)
              </span>
              <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                {stats.countB} itens
              </span>
            </div>
            <CardTitle className="text-xl font-bold font-display pt-1">
              {formatCurrency(stats.totalB)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Representa <strong>{formatPercent(stats.pctB, 1)}</strong> do custo da obra. Monitoramento contínuo.
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilterCategory(filterCategory === 'C' ? 'all' : 'C')}
          className={`cursor-pointer transition-all border-l-4 border-l-emerald-500 hover:shadow-md ${
            filterCategory === 'C' ? 'ring-2 ring-emerald-500' : ''
          }`}
        >
          <CardHeader className="p-4 pb-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">
                Classe C (Itens Menores)
              </span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                {stats.countC} itens
              </span>
            </div>
            <CardTitle className="text-xl font-bold font-display pt-1">
              {formatCurrency(stats.totalC)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Representa <strong>{formatPercent(stats.pctC, 1)}</strong> do valor em {stats.countC} itens pulverizados.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 bg-card rounded-2xl border space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground font-medium">
          <span>Distribuição de Impacto Financeiro</span>
          <span>Total: {formatCurrency(stats.grandTotal)}</span>
        </div>
        <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
          <div
            style={{ width: `${stats.pctA}%` }}
            className="bg-rose-500 transition-all"
            title={`Classe A: ${formatPercent(stats.pctA, 1)}`}
          />
          <div
            style={{ width: `${stats.pctB}%` }}
            className="bg-amber-500 transition-all"
            title={`Classe B: ${formatPercent(stats.pctB, 1)}`}
          />
          <div
            style={{ width: `${stats.pctC}%` }}
            className="bg-emerald-500 transition-all"
            title={`Classe C: ${formatPercent(stats.pctC, 1)}`}
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar insumo ou serviço na Curva ABC..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Todos ({abcAnalysis.length})
            </button>
            <button
              onClick={() => setFilterCategory('A')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterCategory === 'A'
                  ? 'bg-rose-500 text-white font-semibold'
                  : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
            >
              Classe A ({stats.countA})
            </button>
            <button
              onClick={() => setFilterCategory('B')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterCategory === 'B'
                  ? 'bg-amber-500 text-white font-semibold'
                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              Classe B ({stats.countB})
            </button>
            <button
              onClick={() => setFilterCategory('C')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterCategory === 'C'
                  ? 'bg-emerald-500 text-white font-semibold'
                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              }`}
            >
              Classe C ({stats.countC})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 font-semibold text-muted-foreground border-b">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 w-16 text-center">Classe</th>
                <th className="p-3 w-24">Código</th>
                <th className="p-3">Descrição do Item</th>
                <th className="p-3 text-center w-16">Unid</th>
                <th className="p-3 text-right w-20">Qtd</th>
                <th className="p-3 text-right w-28">Unitário</th>
                <th className="p-3 text-right w-32">Total {viewMode === 'selling' && '(c/ BDI)'}</th>
                <th className="p-3 text-right w-20">% Total</th>
                <th className="p-3 text-right w-24">% Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.map((item, index) => {
                const totalItemVal = item.totalCost * multiplier;
                const unitItemVal = item.unitCost * multiplier;

                const getBadgeClass = () => {
                  if (item.category === 'A') return 'bg-rose-500/15 text-rose-600 border-rose-500/30';
                  if (item.category === 'B') return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
                  return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
                };

                return (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-center text-muted-foreground font-mono">
                      {index + 1}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block w-6 text-center py-0.5 rounded-full text-[10px] font-bold border ${getBadgeClass()}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">{item.code}</td>
                    <td className="p-3 font-medium text-foreground">{item.description}</td>
                    <td className="p-3 text-center text-muted-foreground">{item.unit}</td>
                    <td className="p-3 text-right font-mono">{formatNumber(item.quantity, 2)}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {formatCurrency(unitItemVal)}
                    </td>
                    <td className="p-3 text-right font-bold text-foreground font-display">
                      {formatCurrency(totalItemVal)}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {formatPercent(item.percentageOfTotal, 2)}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      {formatPercent(item.accumulatedPercentage, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
