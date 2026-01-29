'use client';

import { useEffect, useState } from "react";
import { Users, Shield, Trash2, Plus, Check, X, Mail } from "lucide-react";
import { GlassPanel } from "@/app/components/ui/GlassPanel";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { listUsers, setRole, setAllowlisted } from "../_actions";
import { Role } from "@/lib/auth";

// Types
interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  emailAddresses: { emailAddress: string }[];
  publicMetadata: { role?: Role | null; allowlisted?: boolean };
  lastSignInAt: number | null;
}

type RoleOption = Role | 'user';

export default function AdminClientPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [users, setUsers] = useState<ClerkUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadData();
  }, [activeTab, page]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const { users: fetchedUsers, totalCount: count } = await listUsers({ limit, offset });
      setUsers(fetchedUsers as unknown as ClerkUser[]);
      setTotalCount(count);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load data", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: RoleOption) => {
    const nextRole = newRole === 'user' ? null : newRole;
    try {
        setUsers(users.map(u => 
            u.id === userId 
                ? { ...u, publicMetadata: { ...u.publicMetadata, role: nextRole } }
                : u
        ));
        
        await setRole(userId, nextRole);
        setToast({ message: "Role updated successfully", type: "success" });
    } catch (err) {
        console.error(err);
        setToast({ message: "Failed to update role", type: "error" });
        loadData();
    }
  };

  const handleAllowlistChange = async (userId: string, allowlisted: boolean) => {
    try {
        setUsers(users.map(u => 
            u.id === userId 
                ? { ...u, publicMetadata: { ...u.publicMetadata, allowlisted } }
                : u
        ));
        
        await setAllowlisted(userId, allowlisted);
        setToast({ message: `User ${allowlisted ? 'approved' : 'rejected'}`, type: "success" });
    } catch (err) {
        console.error(err);
        setToast({ message: "Failed to update access", type: "error" });
        loadData();
    }
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return "Never";
    return new Date(ts).toLocaleDateString();
  };

  const filteredUsers = activeTab === 'all' 
    ? users 
    : users.filter(u => !u.publicMetadata.allowlisted);

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="Admin Dashboard"
          subtitle="Manage users, roles, and access control"
          icon={Shield}
          actions={
            <div className="flex bg-white/30 p-1 rounded-xl backdrop-blur-sm border border-white/40">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'all' 
                            ? 'bg-white shadow-sm text-slate-800' 
                            : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    All Users
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'pending' 
                            ? 'bg-white shadow-sm text-slate-800' 
                            : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    Pending
                    {users.filter(u => !u.publicMetadata.allowlisted).length > 0 && (
                        <span className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {users.filter(u => !u.publicMetadata.allowlisted).length}
                        </span>
                    )}
                </button>
            </div>
          }
        />

        <GlassPanel className="min-h-[50vh]">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 text-white transition-opacity ${
                  toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                }`}>
                  {toast.message}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="animate-fade-in overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-3">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase">User</th>
                                <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase">Last Active</th>
                                <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase">Access</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="bg-white/40 hover:bg-white/60 transition-colors">
                                    <td className="px-6 py-4 first:rounded-l-2xl border-y border-l border-white/50">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={user.imageUrl} 
                                                alt="" 
                                                className="w-10 h-10 rounded-full border border-white shadow-sm"
                                            />
                                            <span className="font-medium text-slate-900">
                                                {user.firstName} {user.lastName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 border-y border-white/50 text-slate-600">
                                        {user.emailAddresses[0]?.emailAddress}
                                    </td>
                                    <td className="px-6 py-4 border-y border-white/50 text-slate-500 text-sm">
                                        {formatDate(user.lastSignInAt)}
                                    </td>
                                    <td className="px-6 py-4 border-y border-white/50">
                                        <select
                                            value={user.publicMetadata.role || 'user'}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value as RoleOption)}
                                            className="bg-white/50 border border-white/60 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                            <option value="superadmin">Superadmin</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 last:rounded-r-2xl border-y border-r border-white/50">
                                        <button
                                            onClick={() => handleAllowlistChange(user.id, !user.publicMetadata.allowlisted)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                user.publicMetadata.allowlisted
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            }`}
                                        >
                                            {user.publicMetadata.allowlisted ? (
                                                <span className="flex items-center gap-1.5"><Check size={14} /> Approved</span>
                                            ) : (
                                                <span className="flex items-center gap-1.5"><X size={14} /> Pending</span>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-slate-500">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            
            {!loading && totalCount > limit && (
                <div className="flex justify-center items-center gap-4 py-4 border-t border-white/20">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white/40 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/60 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-600 font-medium">
                        Page {page} of {Math.ceil(totalCount / limit)}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(Math.ceil(totalCount / limit), p + 1))}
                        disabled={page >= Math.ceil(totalCount / limit)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white/40 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/60 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </GlassPanel>
      </div>
    </div>
  );
}
