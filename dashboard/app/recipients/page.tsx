"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, AlertTriangle, AlertOctagon, Check, Mail, Phone } from "lucide-react";

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
    <div className="space-y-8">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 text-white transition-opacity ${
          toast.type === 'success' ? 'bg-success' : 'bg-danger'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notification Recipients</h1>
          <p className="text-foreground-muted mt-1">Manage who receives alerts via WhatsApp or Email.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary hover:bg-primary-glow text-background font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Add Recipient
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-surface border border-white/5 rounded-2xl shadow-lg overflow-hidden">
          {recipients.length === 0 ? (
            <div className="p-12 text-center text-foreground-muted">
              No recipients found. Add one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background/50 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-foreground-muted">Name</th>
                    <th className="px-6 py-4 text-sm font-medium text-foreground-muted">Contact Info</th>
                    <th className="px-6 py-4 text-sm font-medium text-foreground-muted">Status</th>
                    <th className="px-6 py-4 text-sm font-medium text-foreground-muted">Preferences</th>
                    <th className="px-6 py-4 text-sm font-medium text-foreground-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recipients.map((recipient) => (
                    <tr key={recipient.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {recipient.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground-muted">
                        <div className="flex flex-col gap-1">
                          {recipient.phone && <span className="flex items-center gap-2"><Phone size={14} className="text-primary" /> {recipient.phone}</span>}
                          {recipient.email && <span className="flex items-center gap-2"><Mail size={14} className="text-primary" /> {recipient.email}</span>}
                          {!recipient.phone && !recipient.email && <span className="text-foreground-muted opacity-50">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          recipient.is_active 
                            ? 'bg-success/10 text-success border-success/20' 
                            : 'bg-background/50 text-foreground-muted border-white/10'
                        }`}>
                          {recipient.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <span title="Notify Warning" className={`p-1.5 rounded-lg border ${
                            recipient.notify_warning ? 'bg-warning/10 text-warning border-warning/20' : 'bg-background/30 text-foreground-muted opacity-30 border-transparent'
                          }`}>
                            <AlertTriangle size={16} />
                          </span>
                          <span title="Notify Critical" className={`p-1.5 rounded-lg border ${
                            recipient.notify_critical ? 'bg-danger/10 text-danger border-danger/20' : 'bg-background/30 text-foreground-muted opacity-30 border-transparent'
                          }`}>
                            <AlertOctagon size={16} />
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(recipient)}
                            className="bg-white/5 hover:bg-white/10 text-foreground-muted hover:text-foreground p-2 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmOpen(recipient.id)}
                            className="bg-danger/10 hover:bg-danger/20 text-danger p-2 rounded-lg transition-colors"
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

      {deleteConfirmOpen !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Recipient?</h3>
            <p className="text-foreground-muted mb-6">
              Are you sure you want to delete this recipient? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(null)}
                className="px-4 py-2 rounded-xl text-foreground-muted hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmOpen)}
                className="px-4 py-2 rounded-xl bg-danger text-white hover:bg-danger/90 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-white/10 rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                {editingRecipient ? "Edit Recipient" : "Add New Recipient"}
              </h2>
              <button onClick={closeModal} className="text-foreground-muted hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground ${
                    formErrors.name ? "border-danger" : "border-white/10"
                  }`}
                  placeholder="John Doe"
                />
                {formErrors.name && <p className="text-danger text-xs mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1">
                  Phone (WhatsApp)
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground ${
                    formErrors.phone ? "border-danger" : "border-white/10"
                  }`}
                  placeholder="628123456789"
                />
                {formErrors.phone && <p className="text-danger text-xs mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full px-3 py-2 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground ${
                    formErrors.email ? "border-danger" : "border-white/10"
                  }`}
                  placeholder="john@example.com"
                />
                {formErrors.email && <p className="text-danger text-xs mt-1">{formErrors.email}</p>}
              </div>

              {formErrors.contact && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
                  {formErrors.contact}
                </div>
              )}

              <div className="pt-2 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-5 h-5 text-primary rounded bg-background border-white/10 focus:ring-primary"
                  />
                  <span className="text-foreground group-hover:text-primary transition-colors">Active (Receive Notifications)</span>
                </label>

                <div className="border-t border-white/10 pt-3">
                  <p className="text-sm font-medium text-foreground-muted mb-2">Notification Types</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.notify_warning}
                        onChange={(e) => setFormData({...formData, notify_warning: e.target.checked})}
                        className="w-5 h-5 text-warning rounded bg-background border-white/10 focus:ring-warning"
                      />
                      <span className="text-foreground group-hover:text-warning transition-colors flex items-center gap-2">
                        <AlertTriangle size={16} className="text-warning" />
                        Warning Alerts
                      </span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.notify_critical}
                        onChange={(e) => setFormData({...formData, notify_critical: e.target.checked})}
                        className="w-5 h-5 text-danger rounded bg-background border-white/10 focus:ring-danger"
                      />
                      <span className="text-foreground group-hover:text-danger transition-colors flex items-center gap-2">
                        <AlertOctagon size={16} className="text-danger" />
                        Critical Alerts
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-foreground-muted hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-background font-bold rounded-xl hover:bg-primary-glow disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
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
      )}
    </div>
  );
}
