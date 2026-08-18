import { useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { RawRow, SqlServerConnection } from '../../types';
import { DEFAULT_SQL_QUERY } from '../../lib/defaultSqlQuery';
import {
  executeSqlServerQuery,
  fetchSqlServerDatabases,
  fetchSqlServerMpgs,
} from '../../lib/sqlServerApi';

const CONNECTION_STORAGE_KEY = 'iscore.sqlserver.connection';
const QUERY_STORAGE_KEY = 'iscore.sqlserver.query';

type StoredConnection = Omit<SqlServerConnection, 'password'>;

const defaultConnection: SqlServerConnection = {
  server: '',
  username: '',
  password: '',
  database: '',
  driver: 'ODBC Driver 18 for SQL Server',
  encrypt: true,
  trustServerCertificate: true,
};

function loadConnection(): SqlServerConnection {
  if (typeof window === 'undefined') return defaultConnection;
  try {
    const stored = JSON.parse(window.localStorage.getItem(CONNECTION_STORAGE_KEY) || 'null') as StoredConnection | null;
    return stored ? { ...defaultConnection, ...stored, password: '' } : defaultConnection;
  } catch {
    return defaultConnection;
  }
}

function saveConnection(connection: SqlServerConnection) {
  if (typeof window === 'undefined') return;
  const { password: _password, ...safeConnection } = connection;
  window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(safeConnection));
}

function rowsToRawRows(columns: string[], rows: unknown[][]): RawRow[] {
  return rows.map((values) => {
    const result: RawRow = {};
    columns.forEach((column, index) => {
      result[column] = values[index] as RawRow[string];
    });
    return result;
  });
}

export function SqlServerPanel() {
  const loadDatabaseRows = useDashboardStore((state) => state.loadDatabaseRows);
  const [connection, setConnection] = useState<SqlServerConnection>(loadConnection);
  const [databases, setDatabases] = useState<string[]>([]);
  const [mpgs, setMpgs] = useState<string[]>([]);
  const [mpg, setMpg] = useState('all');
  const [periodeStart, setPeriodeStart] = useState('2025-10-01');
  const [periodeEnd, setPeriodeEnd] = useState('2026-07-01');
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SQL_QUERY;
    return window.localStorage.getItem(QUERY_STORAGE_KEY) || DEFAULT_SQL_QUERY;
  });
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    saveConnection(connection);
  }, [connection]);

  useEffect(() => {
    window.localStorage.setItem(QUERY_STORAGE_KEY, query);
  }, [query]);

  const canConnect = useMemo(
    () => Boolean(connection.server.trim() && connection.username.trim() && connection.password),
    [connection]
  );
  const canExecute = Boolean(connection.database && periodeStart && periodeEnd && query.trim());

  async function loadMpgOptions(nextConnection: SqlServerConnection) {
    try {
      const values = await fetchSqlServerMpgs(nextConnection);
      setMpgs(values);
      setWarning(null);
    } catch (err) {
      setMpgs([]);
      setWarning(`Daftar MPG tidak dapat dimuat. Opsi Semua tetap tersedia. ${err instanceof Error ? err.message : ''}`);
    }
  }

  async function connect() {
    if (!canConnect) return;
    setStatus('connecting');
    setError(null);
    try {
      const values = await fetchSqlServerDatabases(connection);
      setDatabases(values);
      const preferred = values.includes(connection.database)
        ? connection.database
        : values.includes('DesSy')
          ? 'DesSy'
          : values[0] || '';
      const nextConnection = { ...connection, database: preferred };
      setConnection(nextConnection);
      setStatus('connected');
      if (preferred) await loadMpgOptions(nextConnection);
    } catch (err) {
      setStatus('error');
      setDatabases([]);
      setMpgs([]);
      setError(err instanceof Error ? err.message : 'Koneksi SQL Server gagal.');
    }
  }

  async function changeDatabase(database: string) {
    const nextConnection = { ...connection, database };
    setConnection(nextConnection);
    setMpg('all');
    if (database) await loadMpgOptions(nextConnection);
  }

  async function execute() {
    if (!canExecute) return;
    if (periodeStart > periodeEnd) {
      setError('Periode mulai tidak boleh melebihi periode akhir.');
      return;
    }

    setStatus('loading');
    setError(null);
    setWarning(null);
    try {
      const response = await executeSqlServerQuery(
        connection,
        { mpg, periodeStart, periodeEnd },
        query
      );

      if (response.limitExceeded) {
        const proceed = window.confirm(
          'Hasil query melebihi 100.000 baris. Lanjutkan dengan 100.000 baris pertama?'
        );
        if (!proceed) {
          setStatus('connected');
          return;
        }
      }

      loadDatabaseRows(rowsToRawRows(response.columns, response.rows), {
        kind: 'sqlserver',
        label: `${connection.server} / ${response.database}`,
        server: connection.server,
        database: response.database,
        durationMs: response.durationMs,
        returnedRowCount: response.returnedRowCount,
        limitExceeded: response.limitExceeded,
      });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Query SQL Server gagal.');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Tarik dari MS SQL Server</h2>
        <p className="mt-1 text-sm text-slate-500">
          Password hanya dipakai selama sesi ini dan tidak disimpan di browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-300">
          Hostname / server
          <input
            value={connection.server}
            onChange={(event) => setConnection({ ...connection, server: event.target.value, database: '' })}
            placeholder="sqlserver.company.local atau 192.168.1.20"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-violet-500"
          />
        </label>
        <label className="text-sm text-slate-300">
          Username
          <input
            value={connection.username}
            onChange={(event) => setConnection({ ...connection, username: event.target.value, database: '' })}
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-violet-500"
          />
        </label>
      </div>

      <label className="block text-sm text-slate-300">
        Password
        <input
          type="password"
          value={connection.password}
          onChange={(event) => setConnection({ ...connection, password: event.target.value, database: '' })}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-violet-500"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={connect}
          disabled={!canConnect || status === 'connecting'}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'connecting' ? 'Menghubungkan...' : 'Connect & Muat Database'}
        </button>
        {status === 'connected' && <span className="text-sm text-emerald-400">Terhubung</span>}
      </div>

      {databases.length > 0 && (
        <label className="block text-sm text-slate-300">
          Database
          <select
            value={connection.database}
            onChange={(event) => void changeDatabase(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-violet-500"
          >
            <option value="">Pilih database</option>
            {databases.map((database) => <option key={database} value={database}>{database}</option>)}
          </select>
        </label>
      )}

      {connection.database && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-300">
            MPG
            <select
              value={mpg}
              onChange={(event) => setMpg(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-violet-500"
            >
              <option value="all">Semua</option>
              {mpgs.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Periode mulai
            <input type="date" value={periodeStart} onChange={(event) => setPeriodeStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300">
            Periode akhir
            <input type="date" value={periodeEnd} onChange={(event) => setPeriodeEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white" />
          </label>
        </div>
      )}

      {connection.database && (
        <details className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">Edit Query SQL</summary>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} spellCheck={false} rows={16} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none focus:border-violet-500" />
          <button type="button" onClick={() => setQuery(DEFAULT_SQL_QUERY)} className="mt-3 text-xs text-cyan-300 hover:text-cyan-200">Reset ke query default</button>
        </details>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {warning && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{warning}</div>}

      {connection.database && (
        <button type="button" onClick={() => void execute()} disabled={!canExecute || status === 'loading'} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {status === 'loading' ? 'Menarik dan memproses data...' : 'Tarik Data & Analisis'}
        </button>
      )}
    </div>
  );
}
