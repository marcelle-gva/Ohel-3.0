import type { FC } from 'react';
import { Keyboard, Mic } from 'lucide-react';

import type { NaturalLanguageInputProps } from '@/types/agent';

const textareaId = 'ohel-natural-language-input';

export const NaturalLanguageInputCard: FC<NaturalLanguageInputProps> = ({
  value,
  onChange,
  onAudioRecord,
  placeholder = "Exemplo: 'Preciso organizar as compras da semana, levar o Theo na natação às 16h, responder o e-mail do financeiro da empresa e reservar um tempo para meditar...'",
  isRecording = false,
  disabled = false,
}) => {
  return (
    <section className="rounded-[24px] border border-cyan-400/15 bg-gradient-to-br from-[#0F1F3A] via-[#0B1830] to-[#0A1628] p-6 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
              Entrada em linguagem natural
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAudioRecord}
          disabled={disabled}
          aria-label={isRecording ? 'Parar gravação de áudio' : 'Gravar áudio'}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 shadow-[0_0_18px_rgba(56,189,248,0.18)] transition hover:border-cyan-300/60 hover:bg-cyan-400/15 hover:shadow-[0_0_24px_rgba(56,189,248,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1628] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mic className={`h-4 w-4 ${isRecording ? 'text-cyan-300' : 'text-cyan-100'}`} aria-hidden="true" />
          {isRecording ? 'Gravando...' : 'Gravar Áudio'}
        </button>
      </div>

      <div className="space-y-3">
        <label htmlFor={textareaId} className="sr-only">
          Entrada em linguagem natural
        </label>
        <p className="text-sm text-slate-400">
          Despeje sua mente: anotações, transcrição de áudio, desabafos ou listas do dia a dia.
        </p>

        <textarea
          id={textareaId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={8}
          className="min-h-[200px] w-full resize-none rounded-[20px] border border-cyan-400/15 bg-[#0B1830]/80 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:ring-offset-2 focus:ring-offset-[#0A1628] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </section>
  );
};

export default NaturalLanguageInputCard;
