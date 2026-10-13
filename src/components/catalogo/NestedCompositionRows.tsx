import React, { useState } from 'react';
import { useCatalog } from '@/hooks/useCatalog';
import {
  ComposicaoItem,
  INSUMO_GRUPO_COLORS,
  INSUMO_GRUPO_LABELS,
} from '@/types/catalog';
import { Minus, Plus } from 'lucide-react';

const MAX_DEPTH = 6;

function fmtMoney(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function fmtQty(val: number): string {
  return (val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  });
}

/** Botão [+]/[-] para expandir/recolher os insumos de uma composição auxiliar */
export function ExpandToggle({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-[3px] border border-muted-foreground/50 text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
      title={expanded ? 'Recolher insumos da composição' : 'Ver insumos da composição'}
      aria-expanded={expanded}
    >
      {expanded ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
    </button>
  );
}

interface NestedCompositionRowsProps {
  composicaoId: string;
  /** Quantidade da composição na linha pai (coeficiente acumulado) */
  multiplier: number;
  depth?: number;
  /** IDs de composições já percorridas (evita referência circular) */
  visited?: string[];
  /** Renderiza a coluna extra de ações (tabelas editáveis) */
  showActionCol?: boolean;
  /** Custos por categoria conhecidos do item pai (usado se a composição não for encontrada) */
  fallbackBreakdown?: ComposicaoItem['breakdown'];
}

/**
 * Renderiza <tr> filhas com os insumos de uma composição auxiliar.
 * Colunas esperadas: Código | Descrição | Grupo | Und | Coef. | Custo Unit. | Total [| Ações]
 */
export function NestedCompositionRows({
  composicaoId,
  multiplier,
  depth = 1,
  visited = [],
  showActionCol = true,
  fallbackBreakdown,
}: NestedCompositionRowsProps) {
  const { composicoes = [] } = useCatalog();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const colSpan = showActionCol ? 8 : 7;
  const indent = 12 + depth * 18;
  const rowCls = 'bg-muted/25 hover:bg-muted/40 transition-colors';

  const messageRow = (text: string) => (
    <tr className={rowCls}>
      <td colSpan={colSpan} className="py-2 text-xs text-muted-foreground italic" style={{ paddingLeft: indent }}>
        {text}
      </td>
    </tr>
  );

  if (visited.includes(composicaoId) || depth > MAX_DEPTH) {
    return messageRow('Referência circular ou profundidade máxima atingida.');
  }

  const comp = composicoes.find((c) => c.id === composicaoId);

  // Linhas sintéticas por categoria quando não há insumos detalhados
  const categoryRows = (b: NonNullable<ComposicaoItem['breakdown']>) => {
    const cats: Array<{ key: string; label: string; group: ComposicaoItem['group']; value: number }> = [
      { key: 'mat', label: 'Material (valor informado)', group: 'material', value: b.costMaterial },
      { key: 'lab', label: 'Mão de Obra (valor informado)', group: 'labor', value: b.costLabor },
      { key: 'eq', label: 'Equipamento (valor informado)', group: 'equipment', value: b.costEquipment },
      { key: 'oth', label: 'Outros (valor informado)', group: 'other', value: b.costOther },
    ].filter((c) => c.value > 0);

    if (cats.length === 0) return messageRow('Composição sem custos detalhados.');

    return (
      <>
        {cats.map((c) => (
          <tr key={c.key} className={rowCls}>
            <td className="py-2 px-3 text-muted-foreground">—</td>
            <td className="py-2 pr-3 text-foreground/90" style={{ paddingLeft: indent }}>
              <span className="text-muted-foreground mr-1">└</span>
              {c.label}
            </td>
            <td className="py-2 px-2 text-center">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${INSUMO_GRUPO_COLORS[c.group]}`}>
                {INSUMO_GRUPO_LABELS[c.group]}
              </span>
            </td>
            <td className="py-2 px-2 text-center text-muted-foreground font-mono">—</td>
            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmtQty(multiplier)}</td>
            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmtMoney(c.value)}</td>
            <td className="py-2 px-3 text-right font-mono font-semibold">{fmtMoney(c.value * multiplier)}</td>
            {showActionCol && <td />}
          </tr>
        ))}
      </>
    );
  };

  if (!comp) {
    return fallbackBreakdown
      ? categoryRows(fallbackBreakdown)
      : messageRow('Composição não encontrada no catálogo.');
  }

  if (!comp.items || comp.items.length === 0) {
    return categoryRows({
      costMaterial: comp.costMaterial || 0,
      costLabor: comp.costLabor || 0,
      costEquipment: comp.costEquipment || 0,
      costOther: comp.costOther || 0,
    });
  }

  return (
    <>
      {comp.items.map((child) => {
        const isComp = child.itemType === 'composicao' && !!child.composicaoId;
        const qty = (child.coefficient || 0) * multiplier;
        const total = qty * (child.unitCost || 0);
        const isOpen = !!expanded[child.id];

        return (
          <React.Fragment key={child.id}>
            <tr className={rowCls}>
              <td className="py-2 px-3 font-mono text-muted-foreground">
                {isComp ? child.code : `#${child.code}`}
              </td>
              <td className="py-2 pr-3 text-foreground/90" style={{ paddingLeft: indent }}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground">└</span>
                  {isComp && (
                    <ExpandToggle
                      expanded={isOpen}
                      onClick={() => setExpanded((p) => ({ ...p, [child.id]: !p[child.id] }))}
                    />
                  )}
                  <span>{child.description}</span>
                </div>
              </td>
              <td className="py-2 px-2 text-center">
                {isComp ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400">
                    Composição
                  </span>
                ) : (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${INSUMO_GRUPO_COLORS[child.group]}`}>
                    {INSUMO_GRUPO_LABELS[child.group]}
                  </span>
                )}
              </td>
              <td className="py-2 px-2 text-center text-muted-foreground font-mono">{child.unit}</td>
              <td
                className="py-2 px-3 text-right font-mono"
                title={`Coeficiente ${fmtQty(child.coefficient)} × ${fmtQty(multiplier)} = ${fmtQty(qty)}`}
              >
                <div>{fmtQty(child.coefficient)}</div>
                <div className="text-[10px] text-muted-foreground">Qtd: {fmtQty(qty)}</div>
              </td>
              <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                {fmtMoney(child.unitCost)}
              </td>
              <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                {fmtMoney(total)}
              </td>
              {showActionCol && <td />}
            </tr>

            {isComp && isOpen && (
              <NestedCompositionRows
                composicaoId={child.composicaoId as string}
                multiplier={qty}
                depth={depth + 1}
                visited={[...visited, composicaoId]}
                showActionCol={showActionCol}
                fallbackBreakdown={child.breakdown}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
