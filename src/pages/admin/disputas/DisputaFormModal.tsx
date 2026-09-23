// src/pages/admin/disputas/DisputaFormModal.tsx
//
// Registra o resultado de uma sessão de disputa já realizada no SIGA
// Pregão. Reescrito para usar os componentes genéricos REAIS do projeto
// (Modal, TextField, SelectField, TextAreaField, Button) — a versão
// anterior usava um conjunto de componentes duplicado (FormFields.tsx)
// com uma API incompatível (Modal isOpen/widthClass em vez de
// open/size; campos com onChange(value) em vez de onChange(event)),
// o que quebrava a compilação.

import { useEffect, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import { SelectField } from '../../../components/SelectField';
import { TextAreaField } from '../../../components/TextAreaField';
import { Button } from '../../../components/Button';
import {
  Disputa,
  DisputaFormData,
  ResultadoDisputa,
  RESULTADO_DISPUTA_LABEL,
} from '../../../types/disputa';

function criarFormularioVazio(licitacaoId: string): DisputaFormData {
  return {
    licitacaoId,
    dataSessaoRealizada: undefined,
    valorNossaOfertaFinal: undefined,
    valorVencedor: undefined,
    nomeVencedor: '',
    posicaoFinal: undefined,
    resultado: 'em_andamento',
    observacoes: '',
    linkAtaSigaPregao: '',
  };
}

// Converte um número para o texto exibido no campo, no padrão brasileiro
// (vírgula decimal), com até `casas` casas decimais — sem casas de sobra
// quando o valor é "redondo" (ex.: 500000 -> "500000", não "500000,000000").
// Substitui o <input type="number"> nativo, que não entende separador de
// milhar nem vírgula decimal: quem digitasse "500.000,00" tinha o valor
// silenciosamente corrompido pelo navegador (mesmo bug encontrado no
// "Valor total da licitação", em LicitacaoFormModal.tsx).
function numeroParaCampoDecimal(valor: number | null | undefined, casas: number): string {
  if (valor == null) return '';
  const texto = valor
    .toFixed(casas)
    .replace(/0+$/, '')
    .replace(/,$|\.$/, '')
    .replace('.', ',');
  return texto === '' || texto === '-' ? '0' : texto;
}

// Converte o texto digitado de volta para número — aceita tanto vírgula
// decimal com ponto de milhar ("500.000,1234") quanto ponto decimal solto
// ("500000.1234"), sempre preservando até `casas` casas decimais.
function campoParaNumeroDecimal(texto: string, casas: number): number | undefined {
  const limpo = texto.trim();
  if (!limpo) return undefined;
  const semSeparadorMilhar = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const numero = parseFloat(semSeparadorMilhar);
  if (isNaN(numero)) return undefined;
  const fator = Math.pow(10, casas);
  return Math.round(numero * fator) / fator;
}

interface DisputaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: DisputaFormData) => Promise<void>;
  licitacaoId: string;
  numeroPregaoReferencia: string;
  disputaEmEdicao?: Disputa | null;
}

export function DisputaFormModal({
  isOpen,
  onClose,
  onSave,
  licitacaoId,
  numeroPregaoReferencia,
  disputaEmEdicao,
}: DisputaFormModalProps) {
  const [form, setForm] = useState<DisputaFormData>(criarFormularioVazio(licitacaoId));
  const [salvando, setSalvando] = useState(false);
  // Texto exibido nos campos de valor (R$) — separado do número em `form`
  // pelo mesmo motivo do LicitacaoFormModal: preserva o que a pessoa está
  // digitando (milhar + vírgula) em vez de reformatar a cada tecla.
  const [ofertaTexto, setOfertaTexto] = useState('');
  const [vencedorValorTexto, setVencedorValorTexto] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const inicial = disputaEmEdicao ? { ...disputaEmEdicao } : criarFormularioVazio(licitacaoId);
    setForm(inicial);
    setOfertaTexto(numeroParaCampoDecimal(inicial.valorNossaOfertaFinal, 6));
    setVencedorValorTexto(numeroParaCampoDecimal(inicial.valorVencedor, 6));
  }, [isOpen, disputaEmEdicao, licitacaoId]);

  function atualizarCampo<K extends keyof DisputaFormData>(campo: K, valor: DisputaFormData[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const resultadoMudaStatus = form.resultado === 'ganho' || form.resultado === 'perdido';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Disputa — ${numeroPregaoReferencia}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar resultado'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-ink-soft/15 bg-forest-mist/30 px-4 py-3 font-body text-xs text-ink-soft">
          A sessão de disputa acontece no <strong className="text-ink">SIGA Pregão</strong>. Use este
          formulário só para registrar o resultado final aqui no sistema, depois que a sessão ocorrer.
        </div>

        <SelectField
          label="Resultado *"
          required
          value={form.resultado}
          onChange={(e) => atualizarCampo('resultado', e.target.value as ResultadoDisputa)}
          options={Object.entries(RESULTADO_DISPUTA_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {resultadoMudaStatus && (
          <p className="-mt-3 font-body text-xs text-ink-soft">
            Isso vai atualizar automaticamente o status da licitação.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Data/hora da sessão realizada"
            type="datetime-local"
            value={form.dataSessaoRealizada?.slice(0, 16) ?? ''}
            onChange={(e) =>
              atualizarCampo('dataSessaoRealizada', e.target.value ? new Date(e.target.value).toISOString() : undefined)
            }
          />
          <TextField
            label="Posição final"
            type="number"
            value={form.posicaoFinal ?? ''}
            onChange={(e) => atualizarCampo('posicaoFinal', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Ex: 1"
          />
          <TextField
            label="Nossa oferta final (R$)"
            type="text"
            value={ofertaTexto}
            onChange={(e) => {
              setOfertaTexto(e.target.value);
              atualizarCampo('valorNossaOfertaFinal', campoParaNumeroDecimal(e.target.value, 6));
            }}
            placeholder="Ex.: 500.000,1234"
          />
          <TextField
            label="Valor vencedor (R$)"
            type="text"
            value={vencedorValorTexto}
            onChange={(e) => {
              setVencedorValorTexto(e.target.value);
              atualizarCampo('valorVencedor', campoParaNumeroDecimal(e.target.value, 6));
            }}
            placeholder="Ex.: 495.000,1234"
          />
          <div className="col-span-2">
            <TextField
              label="Vencedor"
              value={form.nomeVencedor ?? ''}
              onChange={(e) => atualizarCampo('nomeVencedor', e.target.value)}
              placeholder='"Salutti" se ganhamos, ou nome do concorrente'
            />
          </div>
          <div className="col-span-2">
            <TextField
              label="Link da ata no SIGA Pregão"
              value={form.linkAtaSigaPregao ?? ''}
              onChange={(e) => atualizarCampo('linkAtaSigaPregao', e.target.value)}
              placeholder="https://app.sigapregao.com.br/ata/..."
            />
          </div>
        </div>

        <TextAreaField
          label="Observações"
          value={form.observacoes}
          onChange={(e) => atualizarCampo('observacoes', e.target.value)}
          rows={3}
          placeholder="Ex: motivo da perda, estratégia usada, aprendizados para a próxima disputa"
        />
      </div>
    </Modal>
  );
}
