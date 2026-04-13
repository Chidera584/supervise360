import { useState, useEffect } from "react";
import { MainLayout } from "../../components/Layout/MainLayout";
import { Card } from "../../components/UI/Card";
import { Button } from "../../components/UI/Button";
import { Sliders, TrendingUp, AlertCircle, CheckCircle, Info, Building2, CalendarDays, Trash2 } from "lucide-react";
import { API_BASE_URL, apiClient } from "../../lib/api";
import { useDepartment } from "../../contexts/DepartmentContext";
import { useAuth } from "../../contexts/AuthContext";

interface GpaThresholds {
  high: number;
  medium: number;
  low: number;
}

export function Settings() {
  const { managesAllDepartments, adminDepartments, refreshAdminDepartments } = useDepartment();
  const { user } = useAuth();

  const [allDepartments, setAllDepartments] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [savingDepts, setSavingDepts] = useState(false);
  
  const [globalThresholds, setGlobalThresholds] = useState<GpaThresholds>({
    high: 3.80,
    medium: 3.30,
    low: 0.00
  });
  
  const [departmentThresholds, setDepartmentThresholds] = useState<Record<string, { useCustomThresholds: boolean; thresholds: GpaThresholds }>>({});
  
  const [saving, setSaving] = useState(false);
  const [savingDept, setSavingDept] = useState<string | null>(null);
  const [gpaDeptSelect, setGpaDeptSelect] = useState<string>("");
  const [message, setMessage] = useState<{type: string; text: string} | null>(null);

  type SessionRow = {
    id: number;
    label: string;
    starts_on: string | null;
    ends_on: string | null;
    is_active: boolean;
    created_at?: string;
  };
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [newSession, setNewSession] = useState({ label: '', starts_on: '', ends_on: '', is_active: true });
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editSessionDraft, setEditSessionDraft] = useState({ label: '', starts_on: '', ends_on: '', is_active: true });
  const [sessionSaving, setSessionSaving] = useState(false);

  useEffect(() => {
    loadAllThresholds();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      const loadDepts = async () => {
        const [listRes, meRes] = await Promise.all([
          apiClient.getDepartments(),
          apiClient.getAdminDepartments(),
        ]);
        if (listRes.success && Array.isArray(listRes.data)) {
          setAllDepartments(listRes.data as { id: number; name: string; code: string }[]);
        }
        if (meRes.success && meRes.data) {
          const d = meRes.data as { ids: number[] | null };
          setSelectedDeptIds(d.ids ?? []);
        }
      };
      loadDepts();
    }
  }, [user?.role]);

  const loadSessions = async () => {
    if (user?.role !== 'admin') return;
    setSessionsLoading(true);
    const res = await apiClient.getSessions();
    if (res.success && Array.isArray(res.data)) {
      setSessions(res.data as SessionRow[]);
    }
    setSessionsLoading(false);
  };

  useEffect(() => {
    if (user?.role === 'admin') loadSessions();
  }, [user?.role]);

  const toDateInput = (v: string | null | undefined) => {
    if (!v) return '';
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  const handleCreateSession = async () => {
    if (!newSession.label.trim()) {
      showMessage('error', 'Session label is required');
      return;
    }
    setSessionSaving(true);
    const res = await apiClient.createSession({
      label: newSession.label.trim(),
      starts_on: newSession.starts_on || null,
      ends_on: newSession.ends_on || null,
      is_active: newSession.is_active,
    });
    if (res.success) {
      showMessage('success', 'Academic session created');
      setNewSession({ label: '', starts_on: '', ends_on: '', is_active: true });
      await loadSessions();
    } else {
      showMessage('error', res.message || 'Failed to create session');
    }
    setSessionSaving(false);
  };

  const beginEditSession = (s: SessionRow) => {
    setEditingSessionId(s.id);
    setEditSessionDraft({
      label: s.label,
      starts_on: toDateInput(s.starts_on),
      ends_on: toDateInput(s.ends_on),
      is_active: s.is_active,
    });
  };

  const saveEditSession = async () => {
    if (editingSessionId == null) return;
    if (!editSessionDraft.label.trim()) {
      showMessage('error', 'Label is required');
      return;
    }
    setSessionSaving(true);
    const res = await apiClient.updateSession(editingSessionId, {
      label: editSessionDraft.label.trim(),
      starts_on: editSessionDraft.starts_on || null,
      ends_on: editSessionDraft.ends_on || null,
      is_active: editSessionDraft.is_active,
    });
    if (res.success) {
      showMessage('success', 'Session updated');
      setEditingSessionId(null);
      await loadSessions();
    } else {
      showMessage('error', res.message || 'Failed to update');
    }
    setSessionSaving(false);
  };

  const toggleSessionActive = async (s: SessionRow) => {
    const res = await apiClient.updateSession(s.id, { is_active: !s.is_active });
    if (res.success) {
      showMessage('success', s.is_active ? 'Session deactivated' : 'Session activated');
      await loadSessions();
    } else {
      showMessage('error', res.message || 'Failed to update');
    }
  };

  const removeSession = async (id: number) => {
    if (!window.confirm('Delete this academic session? This only works if no groups or students reference it.')) return;
    const res = await apiClient.deleteSession(id);
    if (res.success) {
      showMessage('success', 'Session removed');
      if (editingSessionId === id) setEditingSessionId(null);
      await loadSessions();
    } else {
      showMessage('error', res.message || 'Cannot delete session');
    }
  };

  const handleSaveAdminDepartments = async () => {
    setSavingDepts(true);
    const res = await apiClient.setAdminDepartments(selectedDeptIds);
    if (res.success) {
      await refreshAdminDepartments();
      showMessage('success', selectedDeptIds.length === 0 ? 'You now manage all departments' : `Managing ${selectedDeptIds.length} department(s)`);
    } else {
      showMessage('error', res.message || 'Failed to update');
    }
    setSavingDepts(false);
  };

  const loadAllThresholds = async () => {
    try {
      localStorage.removeItem("cached_gpa_thresholds");
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/all`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.global) setGlobalThresholds(data.data.global);
        if (data.data?.departments) {
          const map: Record<string, { useCustomThresholds: boolean; thresholds: GpaThresholds }> = {};
          data.data.departments.forEach((d: any) => {
            map[d.name] = { useCustomThresholds: d.useCustomThresholds ?? false, thresholds: d.thresholds ?? { high: 3.8, medium: 3.3, low: 0 } };
          });
          setDepartmentThresholds(map);
          setGpaDeptSelect((prev) => {
            const names = Object.keys(map);
            if (prev && map[prev]) return prev;
            return names[0] ?? "";
          });
        }
      }
    } catch (error) {
      console.error("Error loading thresholds:", error);
      showMessage("error", "Failed to load settings");
    }
  };

  const saveGlobalThresholds = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/global`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`
        },
        body: JSON.stringify(globalThresholds)
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("success", "Global thresholds updated successfully");
        // Force immediate refresh - clear ALL cache
        localStorage.removeItem("cached_gpa_thresholds");
        localStorage.setItem("gpa_thresholds_changed", Date.now().toString());
        // Dispatch multiple events to ensure all listeners catch it
        window.dispatchEvent(new Event("gpa_thresholds_changed"));
        window.dispatchEvent(new Event("refresh_gpa_thresholds"));
        await loadAllThresholds();
      } else {
        showMessage("error", data.message || "Failed to update");
      }
    } catch (error) {
      showMessage("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveDepartmentThresholds = async (deptName: string) => {
    const dept = departmentThresholds[deptName];
    if (!dept) return;
    try {
      setSavingDept(deptName);
      const payload = { useCustomThresholds: dept.useCustomThresholds, ...dept.thresholds };
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/department/${encodeURIComponent(deptName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("success", `Settings updated for ${deptName}`);
        localStorage.removeItem("cached_gpa_thresholds");
        localStorage.setItem("gpa_thresholds_changed", Date.now().toString());
        window.dispatchEvent(new Event("gpa_thresholds_changed"));
        window.dispatchEvent(new Event("refresh_gpa_thresholds"));
        await loadAllThresholds();
      } else {
        showMessage("error", data.message || "Failed to update");
      }
    } catch (error) {
      showMessage("error", "Failed to save");
    } finally {
      setSavingDept(null);
    }
  };

  const updateDeptThresholds = (deptName: string, useCustom?: boolean, thresholds?: GpaThresholds) => {
    setDepartmentThresholds(prev => {
      const current = prev[deptName] ?? { useCustomThresholds: false, thresholds: globalThresholds };
      return {
        ...prev,
        [deptName]: {
          useCustomThresholds: useCustom ?? current.useCustomThresholds,
          thresholds: thresholds ?? current.thresholds
        }
      };
    });
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const validateThresholds = (thresholds: GpaThresholds): boolean => {
    return thresholds.high >= thresholds.medium && 
           thresholds.medium >= thresholds.low && 
           thresholds.low >= 0 && 
           thresholds.high <= 5.0;
  };

  const gpaDeptPanelName =
    gpaDeptSelect && departmentThresholds[gpaDeptSelect] ? gpaDeptSelect : null;
  const gpaDeptPanel = gpaDeptPanelName ? departmentThresholds[gpaDeptPanelName] : null;

  return (
    <MainLayout title="System configuration">
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System configuration</h1>
            <p className="text-gray-600 mt-1">
              Academic sessions, department scope, and GPA tier thresholds for your institution.
            </p>
          </div>
          <div className="p-3 bg-slate-100 rounded-lg">
            <Sliders className="text-slate-700" size={28} />
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-800">
            {message.type === "success" ? <CheckCircle size={20} className="text-slate-600" /> : <AlertCircle size={20} className="text-slate-600" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Admin: Department scope - which departments this admin manages */}
        {user?.role === 'admin' && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-[#1F7A8C]/10 rounded-lg">
                  <Building2 className="text-[#1F7A8C]" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Department Scope</h2>
                  <p className="text-sm text-gray-600">
                    {managesAllDepartments ? 'You manage all departments' : `Managing ${adminDepartments?.length ?? 0} department(s)`}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Select which departments you manage. Leave all unchecked to manage all departments (super admin). Check specific departments to limit your scope.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {allDepartments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDeptIds.includes(d.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeptIds((prev) => [...prev, d.id]);
                        } else {
                          setSelectedDeptIds((prev) => prev.filter((id) => id !== d.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-[#1F7A8C]"
                    />
                    <span className="text-sm">{d.name}</span>
                  </label>
                ))}
              </div>
              <Button
                onClick={handleSaveAdminDepartments}
                disabled={savingDepts}
                className="!rounded-[10px] !bg-[#000080] hover:!bg-[#00006b] !text-white border-0"
              >
                {savingDepts ? 'Saving...' : 'Save Department Scope'}
              </Button>
            </div>
          </Card>
        )}

        {user?.role === 'admin' && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-[#1F7A8C]/10 rounded-lg">
                  <CalendarDays className="text-[#1F7A8C]" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Academic sessions</h2>
                  <p className="text-sm text-gray-600">Create and manage terms; deactivate instead of delete when data still references a session.</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <p className="text-sm font-medium text-slate-800">New session</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
                    <input
                      value={newSession.label}
                      onChange={(e) => setNewSession((p) => ({ ...p, label: e.target.value }))}
                      placeholder="e.g. 2025/2026"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Starts</label>
                    <input
                      type="date"
                      value={newSession.starts_on}
                      onChange={(e) => setNewSession((p) => ({ ...p, starts_on: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Ends</label>
                    <input
                      type="date"
                      value={newSession.ends_on}
                      onChange={(e) => setNewSession((p) => ({ ...p, ends_on: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSession.is_active}
                    onChange={(e) => setNewSession((p) => ({ ...p, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#1F7A8C]"
                  />
                  Active
                </label>
                <Button
                  onClick={handleCreateSession}
                  disabled={sessionSaving}
                  className="!rounded-[10px] !bg-[#000080] hover:!bg-[#00006b] !text-white border-0"
                >
                  {sessionSaving ? 'Saving...' : 'Add session'}
                </Button>
              </div>

              {sessionsLoading ? (
                <p className="text-sm text-slate-600">Loading sessions…</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="p-3 font-medium">Label</th>
                        <th className="p-3 font-medium">Starts</th>
                        <th className="p-3 font-medium">Ends</th>
                        <th className="p-3 font-medium">Active</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} className="border-t border-slate-200">
                          {editingSessionId === s.id ? (
                            <>
                              <td className="p-2">
                                <input
                                  value={editSessionDraft.label}
                                  onChange={(e) => setEditSessionDraft((d) => ({ ...d, label: e.target.value }))}
                                  className="w-full min-w-[120px] px-2 py-1 border rounded"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={editSessionDraft.starts_on}
                                  onChange={(e) => setEditSessionDraft((d) => ({ ...d, starts_on: e.target.value }))}
                                  className="w-full px-2 py-1 border rounded"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={editSessionDraft.ends_on}
                                  onChange={(e) => setEditSessionDraft((d) => ({ ...d, ends_on: e.target.value }))}
                                  className="w-full px-2 py-1 border rounded"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={editSessionDraft.is_active}
                                  onChange={(e) => setEditSessionDraft((d) => ({ ...d, is_active: e.target.checked }))}
                                />
                              </td>
                              <td className="p-2 text-right space-x-2">
                                <Button
                                  type="button"
                                  onClick={saveEditSession}
                                  disabled={sessionSaving}
                                  className="!rounded-[8px] !py-1 !px-3 !text-xs !bg-[#000080] !text-white"
                                >
                                  Save
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSessionId(null)}
                                  className="text-xs text-slate-600 underline"
                                >
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-medium text-slate-900">{s.label}</td>
                              <td className="p-3 text-slate-600">{toDateInput(s.starts_on) || '—'}</td>
                              <td className="p-3 text-slate-600">{toDateInput(s.ends_on) || '—'}</td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => toggleSessionActive(s)}
                                  className={`text-xs px-2 py-1 rounded ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
                                >
                                  {s.is_active ? 'Yes' : 'No'}
                                </button>
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => beginEditSession(s)}
                                  className="text-xs text-[#1F7A8C] font-medium hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSession(s.id)}
                                  className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                                  title="Delete only if unused"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sessions.length === 0 && !sessionsLoading && (
                    <p className="p-4 text-sm text-slate-500">No sessions yet.</p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-3">
          <Info className="text-slate-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-slate-800">
            <p className="font-medium">How it works</p>
            <p className="text-slate-600 mt-1">
              Students are classified into HIGH, MEDIUM, or LOW tiers based on GPA. 
              Groups are formed with balanced tier distribution for optimal collaboration.
            </p>
          </div>
        </div>

        {/* Global Thresholds - Default for departments that don't use custom */}
        {user?.role === 'admin' && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-[#1F7A8C]/10 rounded-lg">
                  <TrendingUp className="text-[#1F7A8C]" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Global Thresholds</h2>
                  <p className="text-sm text-gray-600">Default for all departments (used when a department doesn&apos;t have custom thresholds)</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HIGH Tier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={globalThresholds.high}
                    onChange={(e) => setGlobalThresholds({ ...globalThresholds, high: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base font-medium text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">GPA ≥ this value</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MEDIUM Tier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={globalThresholds.medium}
                    onChange={(e) => setGlobalThresholds({ ...globalThresholds, medium: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base font-medium text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">GPA ≥ this value</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">LOW Tier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={globalThresholds.low}
                    onChange={(e) => setGlobalThresholds({ ...globalThresholds, low: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base font-medium text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">GPA ≥ this value</p>
                </div>
              </div>

              {!validateThresholds(globalThresholds) && (
                <div className="flex items-center gap-2 text-slate-700 text-sm bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <AlertCircle size={16} className="text-slate-500" />
                  <span>Invalid: 0 ≤ LOW ≤ MEDIUM ≤ HIGH ≤ 5.0</span>
                </div>
              )}

              <Button
                onClick={saveGlobalThresholds}
                disabled={saving || !validateThresholds(globalThresholds)}
                className="!rounded-[10px] !bg-[#000080] hover:!bg-[#00006b] !text-white border-0"
              >
                {saving ? "Saving..." : "Save Global Thresholds"}
              </Button>
            </div>
          </Card>
        )}

        {/* Per-department override: one department at a time */}
        {user?.role === 'admin' && Object.keys(departmentThresholds).length > 0 && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Building2 className="text-slate-700" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Department-Specific Thresholds</h2>
                  <p className="text-sm text-gray-600">Choose a department and optionally override global thresholds</p>
                </div>
              </div>

              <div className="max-w-xl space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={gpaDeptSelect}
                    onChange={(e) => setGpaDeptSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base text-gray-900 bg-white"
                  >
                    {Object.keys(departmentThresholds).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {gpaDeptPanelName && gpaDeptPanel && (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gpaDeptPanel.useCustomThresholds}
                          onChange={(e) => updateDeptThresholds(gpaDeptPanelName, e.target.checked)}
                          className="w-4 h-4 rounded text-[#1F7A8C]"
                        />
                        <span className="text-sm font-medium text-gray-800">Use custom thresholds for this department</span>
                      </label>

                      {gpaDeptPanel.useCustomThresholds && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">HIGH</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                value={gpaDeptPanel.thresholds.high}
                                onChange={(e) => updateDeptThresholds(gpaDeptPanelName, undefined, { ...gpaDeptPanel.thresholds, high: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">MEDIUM</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                value={gpaDeptPanel.thresholds.medium}
                                onChange={(e) => updateDeptThresholds(gpaDeptPanelName, undefined, { ...gpaDeptPanel.thresholds, medium: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">LOW</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                value={gpaDeptPanel.thresholds.low}
                                onChange={(e) => updateDeptThresholds(gpaDeptPanelName, undefined, { ...gpaDeptPanel.thresholds, low: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                              />
                            </div>
                          </div>
                          {!validateThresholds(gpaDeptPanel.thresholds) && (
                            <p className="text-xs text-amber-600">Invalid: 0 ≤ LOW ≤ MEDIUM ≤ HIGH ≤ 5.0</p>
                          )}
                        </>
                      )}

                      <Button
                        onClick={() => saveDepartmentThresholds(gpaDeptPanelName)}
                        disabled={savingDept === gpaDeptPanelName || (gpaDeptPanel.useCustomThresholds && !validateThresholds(gpaDeptPanel.thresholds))}
                        className="!rounded-[10px] !bg-[#000080] hover:!bg-[#00006b] !text-white border-0"
                      >
                        {savingDept === gpaDeptPanelName ? "Saving..." : `Save ${gpaDeptPanelName}`}
                      </Button>
                    </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}