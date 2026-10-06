import { useState } from 'react'
import type { ClienteEndereco } from '@/types/cliente'
import { ESTADOS_BRASILEIROS } from '@/types/cliente'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { maskCEP } from '@/utils/masks'
import { isValidCEP } from '@/utils/validators'
import { viaCepService } from '@/services/viaCepService'
import type { ClienteFormErrors } from '@/hooks/useClienteForm'

interface EnderecoTabProps {
  endereco: ClienteEndereco
  errors: ClienteFormErrors
  onChange: (patch: Partial<ClienteEndereco>) => void
  onClearError: (campo: keyof ClienteFormErrors) => void
}

export function EnderecoTab({ endereco, errors, onChange, onClearError }: EnderecoTabProps) {
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false)

  // Busca o endereço assim que o CEP tem 8 dígitos (chamada pelo onChange,
  // com o valor recém-digitado) e também ao sair do campo (onBlur), caso o
  // CEP tenha sido colado ou preenchido de outra forma.
  async function buscarEndereco(cep: string) {
    if (!isValidCEP(cep)) return

    setBuscandoCep(true)
    setCepNaoEncontrado(false)
    const resultado = await viaCepService.buscarEnderecoPorCep(cep)
    setBuscandoCep(false)

    if (!resultado) {
      setCepNaoEncontrado(true)
      return
    }

    onChange({
      endereco: resultado.endereco,
      bairro: resultado.bairro,
      cidade: resultado.cidade,
      estado: resultado.estado,
    })
    onClearError('endereco')
    onClearError('bairro')
    onClearError('cidade')
    onClearError('estado')
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField
          label="CEP *"
          value={endereco.cep}
          error={errors.cep}
          placeholder="00000-000"
          onChange={(e) => {
            const cepMascarado = maskCEP(e.target.value)
            onChange({ cep: cepMascarado })
            onClearError('cep')
            setCepNaoEncontrado(false)
            if (isValidCEP(cepMascarado)) buscarEndereco(cepMascarado)
          }}
          onBlur={() => {
            // Evita repetir a busca se o endereço já foi preenchido pelo onChange.
            if (!endereco.endereco) buscarEndereco(endereco.cep)
          }}
        />
        {buscandoCep && (
          <p className="mt-1 font-body text-xs text-ink-soft">Buscando endereço pelo CEP…</p>
        )}
        {cepNaoEncontrado && !buscandoCep && (
          <p className="mt-1 font-body text-xs text-brass">
            CEP não encontrado — preencha o endereço manualmente.
          </p>
        )}
      </div>

      <TextField
        label="Endereço *"
        value={endereco.endereco}
        error={errors.endereco}
        onChange={(e) => {
          onChange({ endereco: e.target.value })
          onClearError('endereco')
        }}
        className="sm:col-span-2"
      />
      <TextField
        label="Número *"
        value={endereco.numero}
        error={errors.numero}
        onChange={(e) => {
          onChange({ numero: e.target.value })
          onClearError('numero')
        }}
      />
      <TextField
        label="Complemento"
        value={endereco.complemento}
        onChange={(e) => onChange({ complemento: e.target.value })}
      />
      <TextField
        label="Bairro *"
        value={endereco.bairro}
        error={errors.bairro}
        onChange={(e) => {
          onChange({ bairro: e.target.value })
          onClearError('bairro')
        }}
      />
      <TextField
        label="Cidade *"
        value={endereco.cidade}
        error={errors.cidade}
        onChange={(e) => {
          onChange({ cidade: e.target.value })
          onClearError('cidade')
        }}
      />
      <SelectField
        label="Estado *"
        value={endereco.estado}
        error={errors.estado}
        placeholder="UF"
        options={ESTADOS_BRASILEIROS.map((uf) => ({ value: uf, label: uf }))}
        onChange={(e) => {
          onChange({ estado: e.target.value })
          onClearError('estado')
        }}
      />
    </div>
  )
}
