export const getToken = () => localStorage.getItem('gn_token');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}`, 'x-hotel': localStorage.getItem('gn_hotel') || '' });

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${import.meta.env.BACKEND_URL}/api` + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { localStorage.removeItem('gn_token'); location.reload(); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
/** Downloads an Excel report built by the server. */
export async function downloadExcel(kind, params = {}) {
  const res = await fetch(`/api/export/${kind}?${new URLSearchParams(params)}`, { headers: headers() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not make the Excel file');
  const name = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `${kind}.xlsx`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
export const egp = (n) => 'EGP ' + Number(n || 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const today = () => new Date().toLocaleDateString('en-CA');
export const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
