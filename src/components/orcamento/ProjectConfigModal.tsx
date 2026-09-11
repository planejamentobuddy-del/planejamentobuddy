import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBudget } from '@/hooks/useBudget';
import { BudgetStatus } from '@/types/budget';
import { Trash2, Copy } from 'lucide-react';

interface ProjectConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectConfigModal({ open, onOpenChange }: ProjectConfigModalProps) {
  const { activeProject, updateProject, deleteProject, duplicateProject } = useBudget();

  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [totalArea, setTotalArea] = useState<string>('0');
  const [dateBase, setDateBase] = useState('');
  const [status, setStatus] = useState<BudgetStatus>('draft');

  useEffect(() => {
    if (activeProject) {
      setTitle(activeProject.title);
      setClientName(activeProject.clientName);
      setLocation(activeProject.location);
      setTotalArea(activeProject.totalArea ? activeProject.totalArea.toString() : '0');
      setDateBase(activeProject.dateBase);
      setStatus(activeProject.status);
    }
  }, [activeProject]);

  if (!activeProject) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProject(activeProject.id, {
      title: title.trim(),
      clientName: clientName.trim(),
      location: location.trim(),
      totalArea: parseFloat(totalArea) || 0,
      dateBase: dateBase.trim(),
      status,
    });
    onOpenChange(false);
  };

  const handleDuplicate = () => {
    duplicateProject(activeProject.id);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir o orçamento "${activeProject.title}"?`)) {
      deleteProject(activeProject.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações da Obra / Orçamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Título do Orçamento / Obra</Label>
            <Input
              id="edit-title"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-client">Nome do Cliente</Label>
            <Input
              id="edit-client"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-loc">Local da Obra</Label>
              <Input
                id="edit-loc"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-area">Área Construída (m²)</Label>
              <Input
                id="edit-area"
                type="number"
                step="0.01"
                value={totalArea}
                onChange={e => setTotalArea(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-db">Data-Base / Tabela</Label>
              <Input
                id="edit-db"
                placeholder="Ex: 09/2026 - SINAPI (CE)"
                value={dateBase}
                onChange={e => setDateBase(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full h-10 text-xs rounded-xl border bg-background px-3 focus:ring-1 focus:ring-primary"
              >
                <option value="draft">Em Elaboração</option>
                <option value="sent">Enviado ao Cliente</option>
                <option value="approved">Aprovado</option>
                <option value="review">Em Revisão</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-between items-center sm:justify-between w-full pt-4">
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                className="text-xs flex items-center gap-1"
                title="Criar cópia deste orçamento"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </Button>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
