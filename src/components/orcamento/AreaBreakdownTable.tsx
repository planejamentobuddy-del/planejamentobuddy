import React, { useState, useMemo } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Printer,
  ChevronDown,
  ChevronUp,
  Info,
  Maximize2,
  Building,
} from 'lucide-react';
import { BudgetDonutChart } from './BudgetDonutChart';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

export function AreaBreakdownTable() {
  const {
    activeProject,
    stageSummaries,
    directCostTotal,
    sellingPriceTotal,
    materialCostTotal,
    laborCostTotal,
    equipmentCostTotal,
    otherCostTotal,
    updateProject,
  } = useBudget();

  const [mode, setMode] = useState<'cost' | 'selling'>('cost');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [areaInput, setAreaInput] = useState(String(activeProject?.totalArea || 150));

  const totalArea = activeProject?.totalArea || 0;

  const handleAreaSubmit = () => {
    if (!activeProject) return;
    const val = parseFloat(areaInput.replace(',', '.')) || 0;
    if (val > 0) {
      updateProject(activeProject.id, { totalArea: val });
    }
    setIsEditingArea(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Totais consolidados
  const grandTotal = mode === 'selling' ? sellingPriceTotal : directCostTotal;
  const grandMat = materialCostTotal;
  const grandLab = laborCostTotal;
  const grandEq = equipmentCostTotal;
  const grandOth = otherCostTotal;

  const grandTotalPerM2 = totalArea > 0 ? grandTotal / totalArea : 0;
  const grandMatPerM2 = totalArea > 0 ? grandMat / totalArea : 0;
  const grandLabPerM2 = totalArea > 0 ? grandLab / totalArea : 0;
  const grandEqPerM2 = totalArea > 0 ? grandEq / totalArea : 0;
  const grandOthPerM2 = totalArea > 0 ? grandOth / totalArea : 0;

  return (
    <div className="space-y-6 pt-4">
      {/* CARD PRINCIPAL DA TABELA: ORÇAMENTO POR ETAPA E ÁREA DE OBRA */}
      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        {/* Header Bar (Idêntico ao Mockup da Imagem 3) */}
        <div className="p-4 sm:p-5 bg-card border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold font-display text-foreground tracking-tight">
              Orçamento por Etapa e Área de Obra
            </h3>
            <span
              title="Valores totais e por m² calculados para cada etapa da obra com base na área construída cadastrada"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Info className="w-4 h-4" />
            </span>

            {/* Controle inline para conferir / alterar área em m² */}
            <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg border">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>Área:</span>
              {isEditingArea ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={areaInput}
                    onChange={(e) => setAreaInput(e.target.value)}
                    onBlur={handleAreaSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleAreaSubmit()}
                    autoFocus
                    className="h-6 w-20 text-xs p-1 font-bold"
                  />
                  <span>m²</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAreaInput(String(totalArea));
                    setIsEditingArea(true);
                  }}
                  className="font-bold text-foreground hover:text-primary underline font-mono"
                  title="Clique para editar a área total da obra"
                >
                  {totalArea > 0 ? `${totalArea} m²` : 'Definir m²'}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão de Impressão */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePrint}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              title="Imprimir relatório"
            >
              <Printer className="w-4 h-4" />
            </Button>

            {/* Seletor Custo / Venda (como no topo direito da imagem 3) */}
            <div className="w-32">
              <Select value={mode} onValueChange={(v) => setMode(v as 'cost' | 'selling')}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background">
                  <SelectValue placeholder="Modo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  <SelectItem value="cost" className="text-xs font-medium">
                    Custo Direto
                  </SelectItem>
                  <SelectItem value="selling" className="text-xs font-medium">
                    Venda (+BDI)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recolher / Expandir */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-9 w-9 rounded-xl text-muted-foreground"
              title={isCollapsed ? 'Expandir' : 'Recolher'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Tabela de Etapas e Custos por m² */}
        {!isCollapsed && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left min-w-[240px]">Etapa</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">Mão de Obra</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">Material</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">Equipamento</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">Outros</th>
                  <th className="py-3 px-3 text-right min-w-[130px]">
                    {mode === 'selling' ? 'Preço Total' : 'Custo Total'}
                  </th>
                  <th className="py-3 px-4 text-right w-20">% Obra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {stageSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhuma etapa cadastrada no orçamento.
                    </td>
                  </tr>
                ) : (
                  stageSummaries.map((stage) => {
                    const stgTot = mode === 'selling' ? stage.sellingPrice : stage.directCost;
                    const stgTotPerM2 = totalArea > 0 ? stgTot / totalArea : 0;
                    const pct = grandTotal > 0 ? (stgTot / grandTotal) * 100 : 0;

                    return (
                      <tr key={stage.stageId} className="hover:bg-muted/20 transition-colors">
                        {/* Etapa */}
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <span className="font-bold text-muted-foreground mr-2 font-mono">
                            Etapa {stage.code}
                          </span>
                          <span className="font-semibold uppercase tracking-tight">
                            {stage.title}
                          </span>
                        </td>

                        {/* Mão de Obra */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-muted-foreground block font-mono">
                            {formatCurrency(stage.laborCost)}
                          </span>
                          <span className="font-bold text-foreground block font-mono">
                            {formatCurrency(stage.laborPerM2)} / m²
                          </span>
                        </td>

                        {/* Material */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-muted-foreground block font-mono">
                            {formatCurrency(stage.materialCost)}
                          </span>
                          <span className="font-bold text-foreground block font-mono">
                            {formatCurrency(stage.materialPerM2)} / m²
                          </span>
                        </td>

                        {/* Equipamento */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-muted-foreground block font-mono">
                            {formatCurrency(stage.equipmentCost)}
                          </span>
                          <span className="font-bold text-foreground block font-mono">
                            {formatCurrency(stage.equipmentPerM2)} / m²
                          </span>
                        </td>

                        {/* Outros */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-muted-foreground block font-mono">
                            {formatCurrency(stage.otherCost)}
                          </span>
                          <span className="font-bold text-foreground block font-mono">
                            {formatCurrency(stage.otherPerM2)} / m²
                          </span>
                        </td>

                        {/* Custo Total / Preço Total */}
                        <td className="py-3.5 px-3 text-right bg-muted/10">
                          <span className="text-muted-foreground block font-mono font-medium">
                            {formatCurrency(stgTot)}
                          </span>
                          <span className="font-black text-primary block font-mono text-sm">
                            {formatCurrency(stgTotPerM2)} / m²
                          </span>
                        </td>

                        {/* % Obra */}
                        <td className="py-3.5 px-4 text-right font-bold text-muted-foreground font-mono">
                          {formatPercent(pct, 2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Linha de Total Geral (Idêntico ao topo da Imagem 4) */}
              <tfoot className="bg-muted/60 border-t-2 border-border font-bold">
                <tr>
                  <td className="py-4 px-4 text-sm font-black text-foreground uppercase">
                    Total
                  </td>

                  {/* Mão de Obra Total */}
                  <td className="py-4 px-3 text-right">
                    <span className="text-xs text-muted-foreground block font-mono">
                      {formatCurrency(grandLab)}
                    </span>
                    <span className="text-xs font-black text-foreground block font-mono">
                      {formatCurrency(grandLabPerM2)} / m²
                    </span>
                  </td>

                  {/* Material Total */}
                  <td className="py-4 px-3 text-right">
                    <span className="text-xs text-muted-foreground block font-mono">
                      {formatCurrency(grandMat)}
                    </span>
                    <span className="text-xs font-black text-foreground block font-mono">
                      {formatCurrency(grandMatPerM2)} / m²
                    </span>
                  </td>

                  {/* Equipamento Total */}
                  <td className="py-4 px-3 text-right">
                    <span className="text-xs text-muted-foreground block font-mono">
                      {formatCurrency(grandEq)}
                    </span>
                    <span className="text-xs font-black text-foreground block font-mono">
                      {formatCurrency(grandEqPerM2)} / m²
                    </span>
                  </td>

                  {/* Outros Total */}
                  <td className="py-4 px-3 text-right">
                    <span className="text-xs text-muted-foreground block font-mono">
                      {formatCurrency(grandOth)}
                    </span>
                    <span className="text-xs font-black text-foreground block font-mono">
                      {formatCurrency(grandOthPerM2)} / m²
                    </span>
                  </td>

                  {/* Custo/Preço Total Geral */}
                  <td className="py-4 px-3 text-right bg-primary/10">
                    <span className="text-xs text-primary block font-mono font-medium">
                      {formatCurrency(grandTotal)}
                    </span>
                    <span className="text-sm font-black text-primary block font-mono">
                      {formatCurrency(grandTotalPerM2)} / m²
                    </span>
                  </td>

                  {/* 100% */}
                  <td className="py-4 px-4 text-right font-black text-foreground font-mono">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* GRÁFICO DONUT (ESTILO IMAGEM 4) */}
      {!isCollapsed && (
        <BudgetDonutChart
          summaries={stageSummaries}
          viewMode={mode}
          totalArea={totalArea}
        />
      )}
    </div>
  );
}
