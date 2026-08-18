import type {
  SqlServerConnection,
  SqlServerQueryFilters,
  SqlServerQueryResponse,
} from '../types';

type ApiErrorPayload = {
  detail?: { message?: string; safeDetails?: string };
};

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new Error(
      payload?.detail?.safeDetails || payload?.detail?.message || `Request gagal (${response.status}).`
    );
  }
  return response.json() as Promise<T>;
}

function connectionPayload(connection: SqlServerConnection) {
  return {
    server: connection.server,
    username: connection.username,
    password: connection.password,
    database: connection.database || undefined,
    driver: connection.driver || 'ODBC Driver 18 for SQL Server',
    encrypt: connection.encrypt ?? true,
    trustServerCertificate: connection.trustServerCertificate ?? true,
  };
}

export async function fetchSqlServerDatabases(
  connection: Omit<SqlServerConnection, 'database'>
): Promise<string[]> {
  const response = await request<{ databases: string[] }>('/api/connections/sqlserver/databases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(connectionPayload({ ...connection, database: '' })),
  });
  return response.databases;
}

export async function fetchSqlServerMpgs(connection: SqlServerConnection): Promise<string[]> {
  const response = await request<{ mpgs: string[] }>('/api/connections/sqlserver/mpgs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection: connectionPayload(connection) }),
  });
  return response.mpgs;
}

export async function executeSqlServerQuery(
  connection: SqlServerConnection,
  filters: SqlServerQueryFilters,
  sql: string
): Promise<SqlServerQueryResponse> {
  return request<SqlServerQueryResponse>('/api/scoring/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connection: connectionPayload(connection),
      sql,
      mpg: filters.mpg,
      periodeStart: filters.periodeStart,
      periodeEnd: filters.periodeEnd,
      maxRows: 100000,
    }),
  });
}
