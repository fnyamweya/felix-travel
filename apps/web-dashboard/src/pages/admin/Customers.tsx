import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

export function AdminCustomers() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: () => apiClient.admin.listUsers({ role: 'customer', pageSize: 50 }),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <span className="text-muted text-sm">{data?.meta?.total ?? 0} total</span>
      </div>
      <div className="card">
        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((u: any) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</td>
                    <td>{u.email}</td>
                    <td>{u.phone ?? '—'}</td>
                    <td><span className={`badge badge-${u.isActive ? 'success' : 'danger'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
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
