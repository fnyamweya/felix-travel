import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

export function AdminAuditLog() {
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', action],
    queryFn: () => apiClient.admin.getAuditLog({ action: action || undefined, limit: 50 }),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
      </div>
      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action (e.g. payment.checkout_initiated)"
            style={{ maxWidth: 400 }}
          />
        </div>
        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((e: any) => (
                  <tr key={e.id}>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{new Date(e.createdAt).toISOString().replace('T', ' ').slice(0, 19)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{e.actorId?.slice(-8)}</td>
                    <td><span className="badge badge-neutral">{e.actorRole}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#0052cc' }}>{e.action}</td>
                    <td style={{ fontSize: '0.75rem' }}>{e.entityType}:{e.entityId?.slice(-8)}</td>
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
