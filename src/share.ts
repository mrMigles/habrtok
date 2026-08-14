export interface SharedRoute {
  pathIds: string[];
  currentId: string;
}

function safeIds(value: string | null): string[] {
  return (value ?? '')
    .split('.')
    .filter((id) => /^\d+$/.test(id))
    .slice(0, 10);
}

export function parseShareHash(hash: string): SharedRoute | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const currentId = params.get('c') ?? '';
  if (!/^\d+$/.test(currentId)) return null;
  return { pathIds: safeIds(params.get('p')), currentId };
}

export function createShareUrl(pathIds: string[], currentId: string, base = window.location.href): string {
  const url = new URL(base);
  const params = new URLSearchParams();
  const path = pathIds.filter((id) => /^\d+$/.test(id)).slice(0, 10);
  if (path.length > 0) params.set('p', path.join('.'));
  params.set('c', currentId);
  url.hash = params.toString();
  return url.toString();
}
