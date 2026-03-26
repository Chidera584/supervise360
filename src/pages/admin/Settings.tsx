import { useState, useEffect, type ReactNode } from "react";
import { MainLayout } from "../../components/Layout/MainLayout";
import { Button } from "../../components/UI/Button";
import {
  Sliders,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Info,
  Building2,
  Shield,
  Bell,
  ScrollText,
  RotateCcw,
  Check,
  User,
} from "lucide-react";
import { API_BASE_URL, apiClient } from "../../lib/api";
import { useDepartment } from "../../contexts/DepartmentContext";
import { useAuth } from "../../contexts/AuthContext";

const TEAL = "#006D6D";

interface GpaThresholds {
  high: number;
  medium: number;
  low: number;
}

type SettingsTab = "policy" | "access" | "alerts" | "audit";

export function Settings() {
  const { managesAllDepartments, adminDepartments, refreshAdminDepartments } = useDepartment();
  const { user } = useAuth();

  const [allDepartments, setAllDepartments] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [savingDepts, setSavingDepts] = useState(false);

  const [globalThresholds, setGlobalThresholds] = useState<GpaThresholds>({
    high: 3.8,
    medium: 3.3,
    low: 0.0,
  });

  const [departmentThresholds, setDepartmentThresholds] = useState<
    Record<string, { useCustomThresholds: boolean; thresholds: GpaThresholds }>
  >({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDept, setSavingDept] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("policy");
  const [headerSearch, setHeaderSearch] = useState("");

  useEffect(() => {
    loadAllThresholds();
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      const loadDepts = async () => {
        const [listRes, meRes] = await Promise.all([apiClient.getDepartments(), apiClient.getAdminDepartments()]);
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

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveAdminDepartments = async () => {
    setSavingDepts(true);
    const res = await apiClient.setAdminDepartments(selectedDeptIds);
    if (res.success) {
      await refreshAdminDepartments();
      showMessage(
        "success",
        selectedDeptIds.length === 0 ? "You now manage all departments" : `Managing ${selectedDeptIds.length} department(s)`
      );
    } else {
      showMessage("error", res.message || "Failed to update");
    }
    setSavingDepts(false);
  };

  const loadAllThresholds = async () => {
    try {
      setLoading(true);
      localStorage.removeItem("cached_gpa_thresholds");
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/all`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.global) setGlobalThresholds(data.data.global);
        if (data.data?.departments) {
          const map: Record<string, { useCustomThresholds: boolean; thresholds: GpaThresholds }> = {};
          data.data.departments.forEach((d: any) => {
            map[d.name] = {
              useCustomThresholds: d.useCustomThresholds ?? false,
              thresholds: d.thresholds ?? { high: 3.8, medium: 3.3, low: 0 },
            };
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

  const discardChanges = async () => {
    await loadAllThresholds();
    if (user?.role === "admin") {
      const meRes = await apiClient.getAdminDepartments();
      if (meRes.success && meRes.data) {
        const d = meRes.data as { ids: number[] | null };
        setSelectedDeptIds(d.ids ?? []);
      }
    }
    showMessage("success", "Restored last saved values");
  };

  const saveGlobalThresholds = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/global`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`,
        },
        body: JSON.stringify(globalThresholds),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("success", "Global thresholds updated");
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
      setSaving(false);
    }
  };

  const saveFooterBundle = async () => {
    if (user?.role !== "admin") {
      await saveGlobalThresholds();
      return;
    }
    if (!validateThresholds(globalThresholds)) {
      showMessage("error", "Invalid GPA tiers: need 0 ≤ LOW ≤ MEDIUM ≤ HIGH ≤ 5.0");
      return;
    }
    setSaving(true);
    setSavingDepts(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/global`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`,
        },
        body: JSON.stringify(globalThresholds),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Failed to update global thresholds");
        return;
      }
      localStorage.removeItem("cached_gpa_thresholds");
      localStorage.setItem("gpa_thresholds_changed", Date.now().toString());
      window.dispatchEvent(new Event("gpa_thresholds_changed"));
      window.dispatchEvent(new Event("refresh_gpa_thresholds"));

      const deptRes = await apiClient.setAdminDepartments(selectedDeptIds);
      if (!deptRes.success) {
        showMessage("error", deptRes.message || "Failed to update department scope");
        return;
      }
      await refreshAdminDepartments();
      showMessage("success", "Saved academic policy and admin scope");
      await loadAllThresholds();
    } catch {
      showMessage("error", "Failed to save");
    } finally {
      setSaving(false);
      setSavingDepts(false);
    }
  };

  const saveDepartmentThresholds = async (deptName: string) => {
    const dept = departmentThresholds[deptName];
    if (!dept) return;
    try {
      setSavingDept(deptName);
      const payload = { useCustomThresholds: dept.useCustomThresholds, ...dept.thresholds };
      const res = await fetch(
        `${API_BASE_URL}/settings/gpa-thresholds/department/${encodeURIComponent(deptName)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );
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

  const updateDeptThresholds = (
    deptName: string,
    useCustom?: boolean,
    thresholds?: GpaThresholds
  ) => {
    setDepartmentThresholds((prev) => {
      const current = prev[deptName] ?? { useCustomThresholds: false, thresholds: globalThresholds };
      return {
        ...prev,
        [deptName]: {
          useCustomThresholds: useCustom ?? current.useCustomThresholds,
          thresholds: thresholds ?? current.thresholds,
        },
      };
    });
  };

  const validateThresholds = (thresholds: GpaThresholds): boolean => {
    return (
      thresholds.high >= thresholds.medium &&
      thresholds.medium >= thresholds.low &&
      thresholds.low >= 0 &&
      thresholds.high <= 5.0
    );
  };

  const tabBtn = (id: SettingsTab, icon: ReactNode, label: string) => {
    const on = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors text-left ${
          on ? "bg-[#006D6D]/12 text-[#006D6D]" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <span className={on ? "text-[#006D6D]" : "text-slate-400"}>{icon}</span>
        {label}
      </button>
    );
  };

  const manageAllScope = selectedDeptIds.length === 0;
  const filteredDeptEntries = Object.entries(departmentThresholds).filter(([name]) =>
    name.toLowerCase().includes(headerSearch.trim().toLowerCase())
  );

  return (
    <MainLayout
      title="Settings"
      topBarSearch={{
        placeholder: "Search system settings…",
        value: headerSearch,
        onChange: setHeaderSearch,
      }}
    >
      <div className="max-w-6xl mx-auto min-w-0 pb-24">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">System configuration</h1>
          <p className="text-[#4A4A4A] mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
            Manage institutional GPA policy, administrative visibility, and guardrails that affect grouping and
            reporting across Supervise360.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 flex items-center gap-3 p-4 rounded-xl border ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
                : "border-red-200 bg-red-50/90 text-red-900"
            }`}
          >
            {message.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sub-navigation */}
          <nav className="w-full lg:w-56 shrink-0 space-y-1 lg:sticky lg:top-4">
            {tabBtn("policy", <Sliders size={18} />, "Academic policy")}
            {tabBtn("access", <Shield size={18} />, "Security & access")}
            {tabBtn("alerts", <Bell size={18} />, "System alerts")}
            {tabBtn("audit", <ScrollText size={18} />, "Audit logs")}
          </nav>

          <div className="flex-1 min-w-0 space-y-6">
            {loading && activeTab === "policy" ? (
              <div className="text-slate-500 py-12 text-center">Loading settings…</div>
            ) : (
              <>
                {activeTab === "policy" && user?.role === "admin" && (
                  <>
                    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${TEAL}18` }}
                          >
                            <TrendingUp className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-[#1a1a1a]">Global GPA configuration</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-1">
                              Base institutional standards
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid md:grid-cols-3 gap-4">
                        <div className="md:col-span-1 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F8F9FA] p-6">
                          <label className="text-xs font-semibold uppercase text-slate-500">High tier cutoff</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            value={globalThresholds.high}
                            onChange={(e) =>
                              setGlobalThresholds({ ...globalThresholds, high: parseFloat(e.target.value) || 0 })
                            }
                            className="mt-3 w-full max-w-[140px] text-center text-3xl font-bold text-[#1a1a1a] py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25 bg-white"
                          />
                          <p className="text-xs text-slate-500 mt-3 text-center leading-snug">
                            Used for high-tier classification and defense readiness signals.
                          </p>
                        </div>
                        <div className="md:col-span-2 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">Medium tier</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                value={globalThresholds.medium}
                                onChange={(e) =>
                                  setGlobalThresholds({ ...globalThresholds, medium: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                              />
                              <p className="text-xs text-slate-500 mt-1">GPA ≥ this value → medium</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">Low tier floor</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                value={globalThresholds.low}
                                onChange={(e) =>
                                  setGlobalThresholds({ ...globalThresholds, low: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                              />
                              <p className="text-xs text-slate-500 mt-1">GPA ≥ this value → low</p>
                            </div>
                          </div>
                          {!validateThresholds(globalThresholds) && (
                            <div className="flex items-center gap-2 text-amber-800 text-sm bg-amber-50 border border-amber-200/80 p-3 rounded-xl">
                              <AlertCircle size={16} />
                              <span>Invalid: 0 ≤ LOW ≤ MEDIUM ≤ HIGH ≤ 5.0</span>
                            </div>
                          )}
                          <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50/95 border border-amber-200/80 rounded-xl p-4">
                            <AlertCircle className="shrink-0 mt-0.5" size={18} />
                            <p>
                              Changing tier cutoffs affects how existing students are bucketed in dashboards and grouping
                              quality metrics. Communicate policy changes before applying in production.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        <Button
                          onClick={saveGlobalThresholds}
                          disabled={saving || !validateThresholds(globalThresholds)}
                          className="!rounded-[10px] !bg-[#006D6D] hover:!bg-[#005a5a] !text-white"
                        >
                          {saving ? "Saving…" : "Save global tiers only"}
                        </Button>
                      </div>
                    </div>

                    {Object.keys(departmentThresholds).length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                          <div>
                            <h2 className="text-lg font-bold text-[#1a1a1a]">Departmental overrides</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-1">
                              Specific program adjustments
                            </p>
                          </div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: TEAL }}>
                            Toggle custom use per department
                          </span>
                        </div>

                        <div className="space-y-2">
                          {filteredDeptEntries.length === 0 ? (
                            <p className="text-sm text-slate-500 py-6 text-center">No departments match search.</p>
                          ) : (
                            filteredDeptEntries.map(([deptName, dept]) => (
                              <div
                                key={deptName}
                                className="rounded-xl border border-slate-100 bg-[#F8F9FA]/80 p-4 hover:border-slate-200 transition-colors"
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-[#1a1a1a]">{deptName}</p>
                                    <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={dept.useCustomThresholds}
                                        onChange={(e) => updateDeptThresholds(deptName, e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-[#006D6D] focus:ring-[#006D6D]"
                                      />
                                      <span className="text-sm text-slate-600">Use custom thresholds</span>
                                    </label>
                                  </div>
                                  {dept.useCustomThresholds ? (
                                    <div className="grid grid-cols-3 gap-2 lg:w-[280px]">
                                      <div>
                                        <span className="text-[10px] font-bold uppercase text-slate-400">High</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="5"
                                          value={dept.thresholds.high}
                                          onChange={(e) =>
                                            updateDeptThresholds(deptName, undefined, {
                                              ...dept.thresholds,
                                              high: parseFloat(e.target.value) || 0,
                                            })
                                          }
                                          className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                                        />
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Med</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="5"
                                          value={dept.thresholds.medium}
                                          onChange={(e) =>
                                            updateDeptThresholds(deptName, undefined, {
                                              ...dept.thresholds,
                                              medium: parseFloat(e.target.value) || 0,
                                            })
                                          }
                                          className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                                        />
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Low</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="5"
                                          value={dept.thresholds.low}
                                          onChange={(e) =>
                                            updateDeptThresholds(deptName, undefined, {
                                              ...dept.thresholds,
                                              low: parseFloat(e.target.value) || 0,
                                            })
                                          }
                                          className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 lg:text-right">
                                      Inherits global
                                    </p>
                                  )}
                                  <Button
                                    onClick={() => saveDepartmentThresholds(deptName)}
                                    disabled={
                                      savingDept === deptName ||
                                      (dept.useCustomThresholds && !validateThresholds(dept.thresholds))
                                    }
                                    className="!rounded-[10px] shrink-0"
                                  >
                                    {savingDept === deptName ? "Saving…" : "Save"}
                                  </Button>
                                </div>
                                {dept.useCustomThresholds && !validateThresholds(dept.thresholds) && (
                                  <p className="text-xs text-amber-600 mt-2">Invalid tier ordering for this department.</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <div
                      className="rounded-xl border border-slate-200/80 p-4 flex gap-3"
                      style={{ backgroundColor: `${TEAL}08` }}
                    >
                      <Info className="shrink-0 mt-0.5" style={{ color: TEAL }} size={20} />
                      <div className="text-sm text-slate-700">
                        <p className="font-semibold text-[#1a1a1a]">How tiers are used</p>
                        <p className="text-slate-600 mt-1 leading-relaxed">
                          Students are classified into HIGH, MEDIUM, and LOW for dashboards and for balanced group
                          formation where your workflows apply tier mix rules.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "policy" && user?.role !== "admin" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                    You don&apos;t have access to academic policy settings.
                  </div>
                )}

                {activeTab === "access" && user?.role === "admin" && (
                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
                    <div className="flex flex-col xl:flex-row gap-6">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-[#1a1a1a]">Administrative department scope</h2>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-1">
                          Visibility & access control
                        </p>
                        <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                          {managesAllDepartments
                            ? "You currently manage all departments (full visibility)."
                            : `You are limited to ${adminDepartments?.length ?? 0} department(s).`}
                        </p>

                        <div className="mt-5 inline-flex rounded-[10px] border border-slate-200 p-1 bg-[#F8F9FA]">
                          <button
                            type="button"
                            onClick={() => setSelectedDeptIds([])}
                            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              manageAllScope ? "text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
                            }`}
                            style={manageAllScope ? { backgroundColor: TEAL } : undefined}
                          >
                            All departments
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedDeptIds.length === 0 && allDepartments.length > 0) {
                                setSelectedDeptIds([allDepartments[0].id]);
                              }
                            }}
                            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              !manageAllScope ? "text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
                            }`}
                            style={!manageAllScope ? { backgroundColor: TEAL } : undefined}
                          >
                            Selected scope
                          </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-xl border border-slate-100 p-3 bg-[#F8F9FA]/50">
                          {allDepartments.map((d) => (
                            <label
                              key={d.id}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer border border-transparent hover:border-slate-100"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDeptIds.includes(d.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedDeptIds((prev) => [...prev, d.id]);
                                  else setSelectedDeptIds((prev) => prev.filter((id) => id !== d.id));
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-[#006D6D] focus:ring-[#006D6D]"
                              />
                              <span className="text-sm text-slate-800">{d.name}</span>
                            </label>
                          ))}
                        </div>
                        <Button
                          onClick={handleSaveAdminDepartments}
                          disabled={savingDepts}
                          className="mt-4 !rounded-[10px] !bg-[#006D6D] hover:!bg-[#005a5a] !text-white"
                        >
                          {savingDepts ? "Saving…" : "Save scope only"}
                        </Button>
                      </div>
                      <div className="w-full xl:w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Active administrative profile
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: TEAL }}
                          >
                            <User size={22} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1a1a1a] truncate">
                              {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-slate-500">Administrator</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "access" && user?.role !== "admin" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                    Department scope is managed by administrators.
                  </div>
                )}

                {activeTab === "alerts" && (
                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                        <Bell size={20} />
                      </div>
                      <h2 className="text-lg font-bold text-[#1a1a1a]">System alerts</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      In-app and email alert routing is configured server-side. Contact your deployment team to tune
                      SMTP, thresholds, and escalation paths. UI controls for alert subscriptions will appear here in a
                      future release.
                    </p>
                  </div>
                )}

                {activeTab === "audit" && (
                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                        <ScrollText size={20} />
                      </div>
                      <h2 className="text-lg font-bold text-[#1a1a1a]">Audit logs</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Detailed audit trails (sign-ins, settings changes, data exports) are retained on the application
                      server. Request extended retention or SIEM integration from your infrastructure owner.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {user?.role === "admin" && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              Sticky actions: save global GPA tiers and admin scope together. Department overrides still save per
              department above.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={discardChanges}
                disabled={saving || savingDepts}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                Discard
              </button>
              <button
                type="button"
                disabled={saving || savingDepts || !validateThresholds(globalThresholds)}
                onClick={saveFooterBundle}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                <Check className="w-4 h-4" />
                {saving || savingDepts ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
