import { GlobeIcon } from 'lucide-react';
import { useState } from 'react';

export function BookmarkFavicon({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt=""
          className="size-5 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <GlobeIcon className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
