"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, AlertTriangle, AlertOctagon, Check, Users } from "lucide-react";

import { GlassPanel } from "../components/ui/GlassPanel";
import { SectionHeader } from "@/app/components/ui/SectionHeader";

interface Recipient {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  notify_warning: boolean;
  notify_critical: boolean;
}

interface RecipientFormData {
  name: string;
  phone: string;
  email: string;
  is_active: boolean;
  notify_warning: boolean;
  notify_critical: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL 
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`
  : "http://localhost:8181/api/v1";

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<RecipientFormData>({
    name: "",
    phone: "",
    email: "",
    is_active: true,
    notify_warning: true,
    notify_critical: true
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchRecipients();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  async function fetchRecipients() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recipients`);
      if (!res.ok) throw new Error("Failed to fetch recipients");
      const data = await res.json();
      setRecipients(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load recipients", "error");
    } finally {
      setLoading(false);
    }
  }

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    if (!formData.name || formData.name.length < 2) {
      errors.name = "Name is required (min 2 chars)";
    }
    
    if (!formData.phone && !formData.email) {
      errors.contact = "Either Phone or Email is required";
    }

    if (formData.phone) {
      if (!/^(08|62)\d+$/.test(formData.phone)) {
        errors.phone = "Phone must start with 08 or 62 and contain only digits";
      }
    }

    if (formData.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Invalid email format";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const url = editingRecipient 
        ? `${API_BASE_URL}/recipients/${editingRecipient.id}`
        : `${API_BASE_URL}/recipients`;
      
      const method = editingRecipient ? "PATCH" : "POST";
      
      const payload = {
        ...formData,
        phone: formData.phone || null,
        email: formData.email || null
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Operation failed");

      await fetchRecipients();
      closeModal();
      showToast(
        editingRecipient ? "Recipient updated successfully" : "Recipient added successfully", 
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast("Error saving recipient", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/recipients/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Delete failed");

      await fetchRecipients();
      setDeleteConfirmOpen(null);
      showToast("Recipient deleted successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Error deleting recipient", "error");
    }
  };

  const openAddModal = () => {
    setEditingRecipient(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      is_active: true,
      notify_warning: true,
      notify_critical: true
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    setFormData({
      name: recipient.name,
      phone: recipient.phone || "",
      email: recipient.email || "",
      is_active: recipient.is_active,
      notify_warning: recipient.notify_warning,
      notify_critical: recipient.notify_critical
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecipient(null);
  };

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="Notification Recipients"
          subtitle="Manage who receives alerts and escalation messages"
          icon={Users}
          actions={
            <button
              onClick={openAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={18} />
              Add Recipient
            </button>
          }
        />

        <GlassPanel className="min-h-[50vh]">
          {/* Toast Notification */}
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
            <div>
              {recipients.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No recipients found. Add one to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Contact Info</th>
                        <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Preferences</th>
                        <th className="px-6 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((recipient) => (
                        <tr key={recipient.id} className="group bg-white/40 hover:bg-white/80 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.005]">
                          <td className="px-6 py-4 font-medium text-slate-900 first:rounded-l-2xl last:rounded-r-2xl border-y border-l border-white/50 first:border-l last:border-r">
                            {recipient.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 border-y border-white/50">
                            <div className="flex flex-col gap-1">
                              {recipient.phone && <span>📞 {recipient.phone}</span>}
                              {recipient.email && <span>✉️ {recipient.email}</span>}
                              {!recipient.phone && !recipient.email && <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-y border-white/50">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                              recipient.is_active 
                                ? 'bg-green-100/50 text-green-700 border-green-200' 
                                : 'bg-gray-100/50 text-gray-600 border-gray-200'
                            }`}>
                              {recipient.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-y border-white/50">
                            <div className="flex gap-2">
                              <span title="Notify Warning" className={`p-1.5 rounded-lg transition-colors ${
                                recipient.notify_warning ? 'text-yellow-600 bg-yellow-100/50' : 'text-gray-300 bg-gray-100/30'
                              }`}>
                                <AlertTriangle size={18} />
                              </span>
                              <span title="Notify Critical" className={`p-1.5 rounded-lg transition-colors ${
                                recipient.notify_critical ? 'text-red-600 bg-red-100/50' : 'text-gray-300 bg-gray-100/30'
                              }`}>
                                <AlertOctagon size={18} />
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right first:rounded-l-2xl last:rounded-r-2xl border-y border-r border-white/50 first:border-l last:border-r">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(recipient)}
                                className="bg-slate-200/80 hover:bg-slate-300 text-slate-700 p-2 rounded-lg text-sm transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmOpen(recipient.id)}
                                className="bg-red-100/80 hover:bg-red-200 text-red-600 p-2 rounded-lg text-sm transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </GlassPanel>
      </div>

      {deleteConfirmOpen !== null && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-3xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Recipient?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this recipient? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(null)}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-white/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmOpen)}
                className="px-4 py-2 rounded-xl bg-red-500/90 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-0 rounded-3xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/20 flex justify-between items-center bg-white/10">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRecipient ? "Edit Recipient" : "Add New Recipient"}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-4 py-2.5 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                      formErrors.name ? "border-red-500" : "border-white/40 focus:border-blue-500"
                    }`}
                    placeholder="John Doe"
                  />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Phone (WhatsApp)
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={`w-full px-4 py-2.5 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                      formErrors.phone ? "border-red-500" : "border-white/40 focus:border-blue-500"
                    }`}
                    placeholder="628123456789"
                  />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`w-full px-4 py-2.5 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                      formErrors.email ? "border-red-500" : "border-white/40 focus:border-blue-500"
                    }`}
                    placeholder="john@example.com"
                  />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>

                {formErrors.contact && (
                  <div className="p-3 bg-red-50/50 border border-red-200/50 rounded-xl text-red-600 text-sm backdrop-blur-sm">
                    {formErrors.contact}
                  </div>
                )}

                <div className="pt-2 space-y-4">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-blue-500 checked:bg-blue-500"
                        />
                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                            <Check size={14} strokeWidth={3} />
                        </div>
                    </div>
                    <span className="text-slate-700 group-hover:text-slate-900 transition-colors">Active (Receive Notifications)</span>
                  </label>

                  <div className="border-t border-white/30 pt-4">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Notification Types</p>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg transition-colors -ml-2">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.notify_warning}
                                onChange={(e) => setFormData({...formData, notify_warning: e.target.checked})}
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-yellow-500 checked:bg-yellow-500"
                            />
                            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                <Check size={14} strokeWidth={3} />
                            </div>
                        </div>
                        <span className="text-slate-700 flex items-center gap-2">
                          <AlertTriangle size={18} className="text-yellow-500" />
                          Warning Alerts
                        </span>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg transition-colors -ml-2">
                         <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.notify_critical}
                                onChange={(e) => setFormData({...formData, notify_critical: e.target.checked})}
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-red-500 checked:bg-red-500"
                            />
                            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                <Check size={14} strokeWidth={3} />
                            </div>
                        </div>
                        <span className="text-slate-700 flex items-center gap-2">
                          <AlertOctagon size={18} className="text-red-500" />
                          Critical Alerts
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/30 mt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 hover:bg-white/50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        Save Recipient
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
