import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BdiConfig, calculateBdiRate } from '@/types/budget';
import { useBudget } from '@/hooks/useBudget';
import { Calculator, RotateCcw } from 'lucide-react';

interface BdiCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BdiCalculatorModal({ open, onOpenChange }: BdiCalculatorModalProps) {
  const { activeProject, updateBdiConfig } = useBudget();

  const [config, setConfig] = useState<BdiConfig>({
    centralAdministration: 4.5,
    insuranceAndWarranty: 0.8,
    risks: 1.5,
    financialExpenses: 1.2,
    profitMargin: 9.0,
    taxes: {
      pis: 0.65,
      cofins: 3.0,
      iss: 3.0,
      cprb: 4.5,
    },
  });

  useEffect(() => {
    if (activeProject?.bdiConfig) {
      setConfig(activeProject.bdiConfig);
    }
  }, [activeProject]);

  const calculatedRate = calculateBdiRate(config);

  const handleSave = () => {
    updateBdiConfig(config);
    onOpenChange(false);
  };

  const handleResetTCU = () => {
    setConfig({
      centralAdministration: 4.0,
      insuranceAndWarranty: 0.8,
      risks: 1.2,
      financialExpenses: 1.0,
      profitMargin: 8.0,
      taxes: {
        pis: 0.65,
        cofins: 3.0,
        iss: 3.0,
        cprb: 4.5,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/15 text-accent">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Calculadora de BDI (Acórdão TCU 2622)</DialogTitle>
              <DialogDescription>
                Bonificação e Despesas Indiretas aplicadas sobre o custo direto dos serviços
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-3">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Custos Indiretos & Lucro
            </h4>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="ac">Administração Central (AC)</Label>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Input
                id="ac"
                type="number"
                step="0.01"
                value={config.centralAdministration}
                onChange={e =>
                  setConfig({ ...config, centralAdministration: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="sg">Seguros e Garantias (S+G)</Label>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Input
                id="sg"
                type="number"
                step="0.01"
                value={config.insuranceAndWarranty}
                onChange={e =>
                  setConfig({ ...config, insuranceAndWarranty: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="riscos">Riscos e Imprevistos (R)</Label>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Input
                id="riscos"
                type="number"
                step="0.01"
                value={config.risks}
                onChange={e =>
                  setConfig({ ...config, risks: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="df">Despesas Financeiras (DF)</Label>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Input
                id="df"
                type="number"
                step="0.01"
                value={config.financialExpenses}
                onChange={e =>
                  setConfig({ ...config, financialExpenses: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="lucro" className="font-semibold text-primary">
                  Margem de Lucro Bruto (L)
                </Label>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Input
                id="lucro"
                type="number"
                step="0.01"
                className="border-primary/50 font-semibold"
                value={config.profitMargin}
                onChange={e =>
                  setConfig({ ...config, profitMargin: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tributos e Impostos (I)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pis">PIS (%)</Label>
                <Input
                  id="pis"
                  type="number"
                  step="0.01"
                  value={config.taxes.pis}
                  onChange={e =>
                    setConfig({
                      ...config,
                      taxes: { ...config.taxes, pis: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cofins">COFINS (%)</Label>
                <Input
                  id="cofins"
                  type="number"
                  step="0.01"
                  value={config.taxes.cofins}
                  onChange={e =>
                    setConfig({
                      ...config,
                      taxes: { ...config.taxes, cofins: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="iss">ISS Municipal (%)</Label>
                <Input
                  id="iss"
                  type="number"
                  step="0.01"
                  value={config.taxes.iss}
                  onChange={e =>
                    setConfig({
                      ...config,
                      taxes: { ...config.taxes, iss: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cprb">CPRB / Deson. (%)</Label>
                <Input
                  id="cprb"
                  type="number"
                  step="0.01"
                  value={config.taxes.cprb}
                  onChange={e =>
                    setConfig({
                      ...config,
                      taxes: { ...config.taxes, cprb: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/20 space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Taxa de BDI Calculada
                </span>
                <span className="text-2xl font-bold font-display text-primary">
                  {calculatedRate.toFixed(2)}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Fórmula TCU: Para cada R$ 100,00 de custo direto, o preço final da proposta será de{' '}
                <strong className="text-foreground">
                  R$ {(100 * (1 + calculatedRate / 100)).toFixed(2)}
                </strong>
                .
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between items-center sm:justify-between w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetTCU}
            className="text-xs text-muted-foreground flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Padrão TCU
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Aplicar BDI</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
