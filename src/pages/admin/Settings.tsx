import { useState, useEffect } from "react";
import { MainLayout } from "../../components/Layout/MainLayout";
import { Card } from "../../components/UI/Card";
import { Button } from "../../components/UI/Button";
import { Sliders, TrendingUp, AlertCircle, CheckCircle, Info, Building2 } from "lucide-react";
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
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDept, setSavingDept] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: string; text: string} | null>(null);

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
      setLoading(true);
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
        }
      }
    } catch (error) {
      console.error("Error loading thresholds:", error);
      showMessage("error", "Failed to load settings");
    } finally {
      setLoading(false);
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

  return (
    <MainLayout title="Settings">
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GPA Tier Configuration</h1>
            <p className="text-gray-600 mt-1">Configure student classification thresholds</p>
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
                className="!rounded-[10px] !bg-[#4f46e5] hover:!bg-[#00006b] !text-white border-0"
              >
                {savingDepts ? 'Saving...' : 'Save Department Scope'}
              </Button>
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
                className="!rounded-[10px] !bg-[#4f46e5] hover:!bg-[#00006b] !text-white border-0"
              >
                {saving ? "Saving..." : "Save Global Thresholds"}
              </Button>
            </div>
          </Card>
        )}

        {/* Per-Department Custom Thresholds */}
        {user?.role === 'admin' && Object.keys(departmentThresholds).length > 0 && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Building2 className="text-slate-700" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Department-Specific Thresholds</h2>
                  <p className="text-sm text-gray-600">Override global thresholds per department</p>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(departmentThresholds).map(([deptName, dept]) => (
                  <div key={deptName} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">{deptName}</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dept.useCustomThresholds}
                          onChange={(e) => updateDeptThresholds(deptName, e.target.checked)}
                          className="w-4 h-4 rounded text-[#1F7A8C]"
                        />
                        <span className="text-sm">Use custom thresholds</span>
                      </label>
                    </div>

                    {dept.useCustomThresholds && (
                      <>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">HIGH</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="5"
                              value={dept.thresholds.high}
                              onChange={(e) => updateDeptThresholds(deptName, undefined, { ...dept.thresholds, high: parseFloat(e.target.value) || 0 })}
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
                              value={dept.thresholds.medium}
                              onChange={(e) => updateDeptThresholds(deptName, undefined, { ...dept.thresholds, medium: parseFloat(e.target.value) || 0 })}
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
                              value={dept.thresholds.low}
                              onChange={(e) => updateDeptThresholds(deptName, undefined, { ...dept.thresholds, low: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                            />
                          </div>
                        </div>
                        {!validateThresholds(dept.thresholds) && (
                          <p className="text-xs text-amber-600 mb-2">Invalid: 0 ≤ LOW ≤ MEDIUM ≤ HIGH ≤ 5.0</p>
                        )}
                      </>
                    )}

                    <Button
                      onClick={() => saveDepartmentThresholds(deptName)}
                      disabled={savingDept === deptName || (dept.useCustomThresholds && !validateThresholds(dept.thresholds))}
                      className="!rounded-[10px] !bg-[#4f46e5] hover:!bg-[#00006b] !text-white border-0"
                    >
                      {savingDept === deptName ? "Saving..." : `Save ${deptName}`}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}