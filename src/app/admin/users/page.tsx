"use client";

import { useCallback, useEffect, useState } from "react";

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  ticket_count: number;
}

const ROLES = ["customer", "organizer", "admin", "scanner"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch("/api/v1/admin/users?limit=100").then((r) => r.json());
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(user: UserRow, role: string) {
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/v1/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Role update failed");
      return;
    }
    setMsg(`${user.full_name} is now ${data.user.role}.`);
    await load();
  }

  async function deleteUser(user: UserRow) {
    if (!window.confirm(`Delete ${user.full_name} (${user.email})?`)) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/v1/admin/users/${user.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Delete failed");
      return;
    }
    setMsg(`${user.full_name} deleted.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Users</h1>
        <p className="text-sm text-ink-soft">
          {users?.length ?? "…"} registered accounts. Roles control which pages and APIs are available.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-success/10 px-4 py-2.5 text-sm font-medium text-success">{msg}</p>}
      {error && <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-mint-mist/50 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Tickets</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((user) => (
              <tr key={user.id} className="border-t border-line hover:bg-mint-mist/40">
                <td className="px-5 py-3.5">
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-xs text-ink-soft">{user.email}</p>
                </td>
                <td className="px-5 py-3.5">
                  <select
                    className="input max-w-[140px] py-1 text-xs"
                    value={user.role}
                    onChange={(e) => changeRole(user, e.target.value)}
                    aria-label={`Role for ${user.full_name}`}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="tnum px-5 py-3.5">{user.ticket_count}</td>
                <td className="tnum px-5 py-3.5 text-ink-soft">
                  {new Date(user.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    className="text-sm font-medium text-ink-soft hover:text-danger hover:underline"
                    onClick={() => deleteUser(user)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
