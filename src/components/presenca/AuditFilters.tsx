interface Opcao {
  valor: string;
  label: string;
}

interface AuditFiltersProps {
  entidades: Opcao[];
  entidade: string;
  onEntidadeChange: (valor: string) => void;
  de: string;
  ate: string;
  onDeChange: (valor: string) => void;
  onAteChange: (valor: string) => void;
}

/** Filtros da tela de auditoria (Módulo 11): entidade + período. */
export function AuditFilters({
  entidades,
  entidade,
  onEntidadeChange,
  de,
  ate,
  onDeChange,
  onAteChange,
}: AuditFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={entidade}
        onChange={(e) => onEntidadeChange(e.target.value)}
        className="h-10 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink"
      >
        {entidades.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-xs text-ink/50">
        De
        <input
          type="date"
          value={de}
          onChange={(e) => onDeChange(e.target.value)}
          className="h-10 rounded-md border border-ink/20 bg-white px-2 text-sm text-ink"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink/50">
        Até
        <input
          type="date"
          value={ate}
          onChange={(e) => onAteChange(e.target.value)}
          className="h-10 rounded-md border border-ink/20 bg-white px-2 text-sm text-ink"
        />
      </label>
    </div>
  );
}
