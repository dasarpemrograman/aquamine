"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, AlertTriangle, AlertOctagon, Check } from "lucide-react";

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
  
  // Form State
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

  // Toast State
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
      // Basic validation for ID/global phone (08xx or 62xx)
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
    <div className="p-8 bg-white min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 text-white transition-opacity ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Notification Recipients</h1>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Add Recipient
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {recipients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No recipients found. Add one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                    <th className="px-6 py-3 text-sm font-medium text-gray-500">Contact Info</th>
                    <th className="px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="px-6 py-3 text-sm font-medium text-gray-500">Preferences</th>
                    <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recipients.map((recipient) => (
                    <tr key={recipient.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-900">
                        {recipient.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex flex-col gap-1">
                          {recipient.phone && <span>📞 {recipient.phone}</span>}
                          {recipient.email && <span>✉️ {recipient.email}</span>}
                          {!recipient.phone && !recipient.email && <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          recipient.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {recipient.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <span title="Notify Warning" className={`p-1 rounded ${
                            recipient.notify_warning ? 'text-yellow-600 bg-yellow-100' : 'text-gray-300'
                          }`}>
                            <AlertTriangle size={18} />
                          </span>
                          <span title="Notify Critical" className={`p-1 rounded ${
                            recipient.notify_critical ? 'text-red-600 bg-red-100' : 'text-gray-300'
                          }`}>
                            <AlertOctagon size={18} />
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(recipient)}
                            className="bg-zinc-600 hover:bg-zinc-700 text-white p-2 rounded text-sm transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmOpen(recipient.id)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded text-sm transition-colors"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Delete Recipient?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this recipient? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(null)}
                className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmOpen)}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-zinc-900">
                {editingRecipient ? "Edit Recipient" : "Add New Recipient"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="John Doe"
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (WhatsApp)
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.phone ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="628123456789"
                />
                {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.email ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="john@example.com"
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>

              {formErrors.contact && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                  {formErrors.contact}
                </div>
              )}

              <div className="pt-2 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Active (Receive Notifications)</span>
                </label>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Notification Types</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notify_warning}
                        onChange={(e) => setFormData({...formData, notify_warning: e.target.checked})}
                        className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-400"
                      />
                      <span className="text-gray-700 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-yellow-500" />
                        Warning Alerts
                      </span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notify_critical}
                        onChange={(e) => setFormData({...formData, notify_critical: e.target.checked})}
                        className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-gray-700 flex items-center gap-2">
                        <AlertOctagon size={16} className="text-red-600" />
                        Critical Alerts
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
      )}
    </div>
  );
}
