import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

export function AdminProviders() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => apiClient.providers.list(),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Service Providers</h1>
      </div>
      <div className="card">
        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Currency</th>
                  <th>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.country}</td>
                    <td>{p.currencyCode}</td>
                    <td>{p.commissionRateBps ? `${p.commissionRateBps / 100}%` : '—'}</td>
                    <td><span className={`badge badge-${p.isActive ? 'success' : 'neutral'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
