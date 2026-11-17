import { XIcon } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { MAX_TAGS, normalizeTag, TAG_HINT, TAG_PATTERN } from '@/lib/tags';
import { cn } from '@/lib/utils';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  onErrorChange?: (error: string | null) => void;
}

const SEPARATOR = /[\s,]+/;

export function TagInput({ id, value, onChange, disabled, invalid, onErrorChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit(raw: string): boolean {
    const candidates = raw.split(SEPARATOR).map(normalizeTag).filter(Boolean);
    if (candidates.length === 0) {
      return true;
    }
    if (candidates.some((tag) => !TAG_PATTERN.test(tag))) {
      onErrorChange?.(TAG_HINT);
      return false;
    }
    const next = [...new Set([...value, ...candidates])];
    if (next.length > MAX_TAGS) {
      onErrorChange?.(`A bookmark can have at most ${MAX_TAGS} tags.`);
      return false;
    }
    onErrorChange?.(null);
    onChange(next);
    return true;
  }

  function handleChange(text: string) {
    const parts = text.split(SEPARATOR);
    if (parts.length > 1) {
      const rest = parts.pop() ?? '';
      setDraft(commit(parts.join(' ')) ? rest : text);
      return;
    }
    setDraft(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (commit(draft)) {
        setDraft('');
      }
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onErrorChange?.(null);
      onChange(value.slice(0, -1));
    }
  }

  function remove(tag: string) {
    onErrorChange?.(null);
    onChange(value.filter((item) => item !== tag));
  }

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
        invalid && 'border-destructive ring-3 ring-destructive/20 dark:ring-destructive/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-secondary pr-1 pl-2 text-xs font-medium text-secondary-foreground"
        >
          #{tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="rounded-sm p-0.5 opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2"
            aria-label={`Remove tag ${tag}`}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (commit(draft)) {
            setDraft('');
          }
        }}
        placeholder={value.length === 0 ? 'Add tags' : ''}
        aria-invalid={invalid}
        className="h-6 min-w-24 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
