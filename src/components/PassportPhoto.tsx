import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { photoError } from '@/lib/hr-enrollment';

const W = 350, H = 450; // passport ratio 35 x 45

/** Signed link for a stored passport photo. */
export function useOfficerPhoto(path: string | null | undefined) {
  return useQuery({
    queryKey: ['officer-photo', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from('officer-files').createSignedUrl(path!, 3600)).data?.signedUrl ?? null,
  }).data ?? null;
}

export function OfficerPhoto({ path, name, className = 'h-12 w-10' }: { path: string | null | undefined; name: string; className?: string }) {
  const url = useOfficerPhoto(path);
  return <div className={`${className} shrink-0 rounded bg-muted overflow-hidden grid place-items-center text-[9px] text-muted-foreground`}>{url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : 'Photo'}</div>;
}

export async function uploadOfficerPhoto(officerId: string, blob: Blob) {
  const path = `${officerId}/photo-${Date.now()}.jpg`;
  const up = await supabase.storage.from('officer-files').upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const r = await supabase.from('officers').update({ photo_url: path }).eq('id', officerId);
  if (r.error) throw r.error;
  return path;
}

/** Choose, preview, crop/zoom and confirm a passport photo. Calls onChange with the cropped JPEG. */
export function PassportPhotoPicker({ currentPath, onChange, required }: { currentPath?: string | null; onChange: (b: Blob | null) => void; required?: boolean }) {
  const current = useOfficerPhoto(currentPath);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1); const [x, setX] = useState(50); const [y, setY] = useState(50);
  const canvas = useRef<HTMLCanvasElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const err = photoError(f); if (err) { toast.error(err); return; }
    const i = new Image(); i.onload = () => { setImg(i); setZoom(1); setX(50); setY(50); }; i.src = URL.createObjectURL(f);
  };

  useEffect(() => {
    const c = canvas.current; if (!img || !c) return;
    const ctx = c.getContext('2d')!; const base = Math.max(W / img.width, H / img.height) * zoom;
    const dw = img.width * base, dh = img.height * base;
    const dx = -(dw - W) * (x / 100), dy = -(dh - H) * (y / 100);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, dx, dy, dw, dh);
    const t = setTimeout(() => c.toBlob(b => onChange(b), 'image/jpeg', 0.9), 150);
    return () => clearTimeout(t);
  }, [img, zoom, x, y, onChange]);

  return <fieldset className="border-t pt-4 space-y-2"><legend className="text-sm font-semibold pr-2">Passport-size photograph{required ? ' *' : ''}</legend>
    <div className="flex flex-wrap gap-4 items-start">
      <div className="w-[105px] h-[135px] rounded border bg-muted overflow-hidden grid place-items-center text-xs text-muted-foreground">
        {img ? <canvas ref={canvas} width={W} height={H} className="w-full h-full" /> : current ? <img src={current} alt="Current photo" className="w-full h-full object-cover" /> : 'No photo'}
      </div>
      <div className="space-y-2 text-sm flex-1 min-w-[200px]">
        <label className="inline-block"><span className="sr-only">Choose photo</span><input type="file" accept="image/jpeg,image/png" aria-label="Passport photo" className="text-sm" onChange={e => pick(e.target.files?.[0])} /></label>
        <p className="text-xs text-muted-foreground">JPG, JPEG or PNG, up to 5 MB.</p>
        {img && <div className="space-y-1">
          {([['Zoom', zoom, setZoom, 1, 3, 0.05], ['Left / right', x, setX, 0, 100, 1], ['Up / down', y, setY, 0, 100, 1]] as const).map(([l, v, set, min, max, step]) => <div key={l} className="flex items-center gap-2"><Label className="w-24 text-xs">{l}</Label><input type="range" aria-label={l} min={min} max={max} step={step} value={v} onChange={e => (set as (n: number) => void)(Number(e.target.value))} className="flex-1" /></div>)}
          <Button type="button" size="sm" variant="ghost" onClick={() => { setImg(null); onChange(null); }}>Remove new photo</Button>
        </div>}
      </div>
    </div></fieldset>;
}
