// src/pages/admin/ConfiguracoesPage.tsx
//
// Página de Configurações do sistema (/admin/configuracoes). Três seções,
// cada uma salva independentemente: Dados da Empresa, Regra de Prazo
// Interno (usada por prazoUtils.calcularPrazoInterno em todo o sistema) e
// Links Rápidos (portais de licitação, hoje só editáveis aqui — a "Mesa de
// Trabalho" que os exibiria ainda não foi construída).

import { useEffect, useState } from 'react';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { LiberacaoIndicadoresSecao } from '../../components/indicadores/LiberacaoIndicadoresSecao';
import { configuracaoService } from '../../services/configuracaoService';
import { ConfiguracoesSistema, DadosEmpresa, RegraPrazoInterno, LinkRapido } from '../../types/configuracoes';

function gerarIdLocal(): string {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ConfiguracoesPage() {
  const [config, setConfig] = useState<ConfiguracoesSistema | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [dadosEmpresa, setDadosEmpresa] = useState<DadosEmpresa | null>(null);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);

  const [regraPrazo, setRegraPrazo] = useState<RegraPrazoInterno | null>(null);
  const [salvandoPrazo, setSalvandoPrazo] = useState(false);

  const [links, setLinks] = useState<LinkRapido[]>([]);
  const [salvandoLinks, setSalvandoLinks] = useState(false);

  useEffect(() => {
    configuracaoService.obter().then((c) => {
      setConfig(c);
      setDadosEmpresa(c.dadosEmpresa);
      setRegraPrazo(c.regraPrazoInterno);
      setLinks(c.linksRapidos);
      setCarregando(false);
    });
  }, []);

  async function salvarEmpresa() {
    if (!dadosEmpresa) return;
    setSalvandoEmpresa(true);
    try {
      const atualizado = await configuracaoService.atualizarDadosEmpresa(dadosEmpresa);
      setConfig(atualizado);
    } finally {
      setSalvandoEmpresa(false);
    }
  }

  async function salvarPrazo() {
    if (!regraPrazo) return;
    setSalvandoPrazo(true);
    try {
      const atualizado = await configuracaoService.atualizarRegraPrazo(regraPrazo);
      setConfig(atualizado);
    } finally {
      setSalvandoPrazo(false);
    }
  }

  function adicionarLink() {
    setLinks((atual) => [...atual, { id: gerarIdLocal(), label: '', url: '' }]);
  }

  function atualizarLink(id: string, campo: keyof LinkRapido, valor: string) {
    setLinks((atual) => atual.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function removerLink(id: string) {
    setLinks((atual) => atual.filter((l) => l.id !== id));
  }

  async function salvarLinks() {
    setSalvandoLinks(true);
    try {
      const validos = links.filter((l) => l.label.trim() && l.url.trim());
      const atualizado = await configuracaoService.atualizarLinksRapidos(validos);
      setConfig(atualizado);
      setLinks(atualizado.linksRapidos);
    } finally {
      setSalvandoLinks(false);
    }
  }

  if (carregando || !dadosEmpresa || !regraPrazo) {
    return (
      <div className="min-h-screen bg-paper p-8">
        <p className="font-body text-sm text-ink-soft">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Configurações</h1>
        <p className="font-body text-sm text-ink-soft">
          Ajustes gerais do sistema — mudanças aqui afetam todo mundo, não só a sua conta.
        </p>
        {config && (
          <p className="mt-1 font-body text-xs text-ink-soft/70">
            Última atualização: {new Date(config.atualizadoEm).toLocaleString('pt-BR')}
          </p>
        )}
      </header>

      <div className="space-y-6">
        {/* Dados da Empresa */}
        <section className="rounded-xl border border-charcoal-3/10 bg-white p-6 shadow-soft">
          <h2 className="mb-4 font-display text-lg font-semibold text-forest-deep">Dados da Empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Razão social"
              value={dadosEmpresa.razaoSocial}
              onChange={(e) => setDadosEmpresa({ ...dadosEmpresa, razaoSocial: e.target.value })}
            />
            <TextField
              label="Nome fantasia"
              value={dadosEmpresa.nomeFantasia}
              onChange={(e) => setDadosEmpresa({ ...dadosEmpresa, nomeFantasia: e.target.value })}
            />
            <TextField
              label="CNPJ"
              value={dadosEmpresa.cnpj}
              onChange={(e) => setDadosEmpresa({ ...dadosEmpresa, cnpj: e.target.value })}
            />
            <TextField
              label="Telefone"
              value={dadosEmpresa.telefone}
              onChange={(e) => setDadosEmpresa({ ...dadosEmpresa, telefone: e.target.value })}
            />
            <TextField
              label="E-mail"
              value={dadosEmpresa.email}
              onChange={(e) => setDadosEmpresa({ ...dadosEmpresa, email: e.target.value })}
            />
            <TextField
              label="Endereço"
              value={dadosEmpresa.endereco}
              onChange={(e) => setDadosEmpresa({ ...dadosEmpresa, endereco: e.target.value })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={salvarEmpresa} disabled={salvandoEmpresa}>
              {salvandoEmpresa ? 'Salvando...' : 'Salvar dados da empresa'}
            </Button>
          </div>
        </section>

        {/* Regra de Prazo Interno */}
        <section className="rounded-xl border border-charcoal-3/10 bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-forest-deep">Regra de Prazo Interno</h2>
          <p className="mt-1 mb-4 font-body text-sm text-ink-soft">
            Usada em todo o sistema para calcular o "limite de retorno do cliente" a partir da data da
            licitação — hoje aparece em Licitações, no Painel do Funcionário e no Painel do Cliente.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Dias úteis antes da sessão"
              type="number"
              value={regraPrazo.diasUteisAntes}
              onChange={(e) => setRegraPrazo({ ...regraPrazo, diasUteisAntes: Number(e.target.value) })}
            />
            <TextField
              label="Horário limite"
              type="time"
              value={regraPrazo.horario}
              onChange={(e) => setRegraPrazo({ ...regraPrazo, horario: e.target.value })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={salvarPrazo} disabled={salvandoPrazo}>
              {salvandoPrazo ? 'Salvando...' : 'Salvar regra de prazo'}
            </Button>
          </div>
        </section>

        {/* Links Rápidos */}
        <section className="rounded-xl border border-charcoal-3/10 bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-forest-deep">Links Rápidos</h2>
          <p className="mt-1 mb-4 font-body text-sm text-ink-soft">
            Portais de licitação usados com frequência pela equipe.
          </p>
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-4">
                  <TextField
                    label="Nome"
                    value={link.label}
                    onChange={(e) => atualizarLink(link.id, 'label', e.target.value)}
                    placeholder="Ex: ComprasNet"
                  />
                </div>
                <div className="col-span-7">
                  <TextField
                    label="URL"
                    value={link.url}
                    onChange={(e) => atualizarLink(link.id, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removerLink(link.id)}
                    aria-label="Remover link"
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {links.length === 0 && (
              <p className="font-body text-xs italic text-ink-soft">Nenhum link cadastrado ainda.</p>
            )}
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={adicionarLink}>
              + Novo link
            </Button>
            <Button onClick={salvarLinks} disabled={salvandoLinks}>
              {salvandoLinks ? 'Salvando...' : 'Salvar links rápidos'}
            </Button>
          </div>
        </section>

        {/* Liberação de Indicadores (nível 1) */}
        <LiberacaoIndicadoresSecao />
      </div>
    </div>
  );
}
