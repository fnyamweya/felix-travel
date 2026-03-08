import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';
import { Link } from 'react-router-dom';

const CATEGORY_COLORS: Record<string, string> = {
  commission: 'badge-purple', tax: 'badge-warning', duty: 'badge-warning',
  fee: 'badge-info', levy: 'badge-warning', surcharge: 'badge-info',
  discount: 'badge-success', withholding: 'badge-danger', fx: 'badge-info', adjustment: 'badge-neutral',
};

export function AdminCharges() {
  const qc = useQueryClient();

  const { data: definitions, isLoading } = useQuery({
    queryKey: ['charge-definitions'],
    queryFn: () => apiClient.charges.listDefinitions(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      apiClient.charges.updateDefinition(id, { isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charge-definitions'] }),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Charge Engine</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/admin/charges/simulate">
            <button className="btn-secondary">🧮 Simulate</button>
          </Link>
        </div>
      </div>

      <div className="alert-warning" style={{ marginBottom: '1rem' }}>
        ⚠️ Changes to charge definitions affect all future bookings. Rate changes require approval if the definition has <code>requiresApproval: true</code>.
      </div>

      <div className="card">
        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Scope</th>
                  <th>Payer</th>
                  <th>Base</th>
                  <th>Method</th>
                  <th>Priority</th>
                  <th>Refund</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {(definitions ?? []).map((def: any) => (
                  <tr key={def.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem' }}>{def.code}</td>
                    <td>{def.name}</td>
                    <td><span className={`badge ${CATEGORY_COLORS[def.category] ?? 'badge-neutral'}`}>{def.category}</span></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)' }}>{def.scope.replace('_level', '')}</td>
                    <td><span className="badge badge-neutral">{def.payer}</span></td>
                    <td style={{ fontSize: '0.75rem' }}>{def.baseType?.replace('_', ' ')}</td>
                    <td style={{ fontSize: '0.75rem' }}>{def.calcMethod?.replace('_', ' ')}</td>
                    <td style={{ textAlign: 'center' }}>{def.calcPriority}</td>
                    <td style={{ fontSize: '0.75rem' }}>{def.refundBehavior?.replace(/_/g, ' ')}</td>
                    <td>
                      <button
                        onClick={() => toggleMutation.mutate({ id: def.id, isEnabled: !def.isEnabled })}
                        className={`badge ${def.isEnabled ? 'badge-success' : 'badge-danger'}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '4px 10px' }}
                      >
                        {def.isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
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
