import type { ClienteDadosEmpresa, ClienteStatus } from '@/types/cliente'
import { SEGMENTOS_DISPONIVEIS } from '@/types/cliente'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { maskCNPJ } from '@/utils/masks'
import type { ClienteFormErrors } from '@/hooks/useClienteForm'

interface DadosEmpresaTabProps {
  empresa: ClienteDadosEmpresa
  status: ClienteStatus
  errors: ClienteFormErrors
  onChange: (patch: Partial<ClienteDadosEmpresa>) => void
  onChangeStatus: (status: ClienteStatus) => void
  onClearError: (campo: keyof ClienteFormErrors) => void
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
]

export function DadosEmpresaTab({
  empresa,
  status,
  errors,
  onChange,
  onChangeStatus,
  onClearError,
}: DadosEmpresaTabProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Razão Social *"
        value={empresa.razaoSocial}
        error={errors.razaoSocial}
        onChange={(e) => {
          onChange({ razaoSocial: e.target.value })
          onClearError('razaoSocial')
        }}
        className="sm:col-span-2"
      />
      <TextField
        label="Nome Fantasia *"
        value={empresa.nomeFantasia}
        error={errors.nomeFantasia}
        onChange={(e) => {
          onChange({ nomeFantasia: e.target.value })
          onClearError('nomeFantasia')
        }}
      />
      <TextField
        label="CNPJ *"
        value={empresa.cnpj}
        error={errors.cnpj}
        placeholder="00.000.000/0000-00"
        onChange={(e) => {
          onChange({ cnpj: maskCNPJ(e.target.value) })
          onClearError('cnpj')
        }}
      />
      <SelectField
        label="Segmento *"
        value={empresa.segmento}
        error={errors.segmento}
        placeholder="Selecione um segmento"
        options={SEGMENTOS_DISPONIVEIS.map((s) => ({ value: s, label: s }))}
        onChange={(e) => {
          onChange({ segmento: e.target.value })
          onClearError('segmento')
        }}
      />
      <TextField
        label="Inscrição Estadual"
        value={empresa.inscricaoEstadual}
        onChange={(e) => onChange({ inscricaoEstadual: e.target.value })}
      />
      <TextField
        label="Site"
        type="url"
        placeholder="https://"
        value={empresa.site}
        onChange={(e) => onChange({ site: e.target.value })}
        className="sm:col-span-2"
      />
      <SelectField
        label="Status do cliente *"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(e) => onChangeStatus(e.target.value as ClienteStatus)}
      />
    </div>
  )
}
