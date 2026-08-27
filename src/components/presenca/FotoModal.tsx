interface FotoModalProps {
  url: string;
  titulo?: string;
  onFechar: () => void;
}

/** Modal genérico pra ver uma foto em tamanho grande — usado em qualquer tela que mostre foto de check-in/atendimento. */
export function FotoModal({ url, titulo, onFechar }: FotoModalProps) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div className="flex max-h-full max-w-full flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        {titulo && <p className="text-center text-sm font-medium text-white">{titulo}</p>}
        <img src={url} alt={titulo ?? "Foto"} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
        <button
          type="button"
          onClick={onFechar}
          className="self-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
