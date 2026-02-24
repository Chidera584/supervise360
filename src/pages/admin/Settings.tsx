import { useState, useEffect } from "react";
import { MainLayout } from "../../components/Layout/MainLayout";
import { Card } from "../../components/UI/Card";
import { Button } from "../../components/UI/Button";
import { Sliders, TrendingUp, AlertCircle, CheckCircle, Info, BarChart3, Mail } from "lucide-react";
import { apiClient, API_BASE_URL } from "../../lib/api";
import { useDepartment } from "../../contexts/DepartmentContext";
import { useAuth } from "../../contexts/AuthContext";

interface GpaThresholds {
  high: number;
  medium: number;
  low: number;
}

interface TierDistribution {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  total: number;
}

export function Settings() {
  const { userDepartment, isSystemAdmin } = useDepartment();
  const { user } = useAuth();
  const department = userDepartment; // Use userDepartment for consistency
  const isSuperAdmin = user?.role === "admin" && isSystemAdmin;
  
  console.log('🔍 [Settings] Department context:', { userDepartment, department, isSystemAdmin, isSuperAdmin, userRole: user?.role });
  
  const [globalThresholds, setGlobalThresholds] = useState<GpaThresholds>({
    high: 3.80,
    medium: 3.30,
    low: 0.00
  });
  
  const [useCustomThresholds, setUseCustomThresholds] = useState(false);
  const [deptThresholds, setDeptThresholds] = useState<GpaThresholds>({
    high: 3.80,
    medium: 3.30,
    low: 0.00
  });
  
  const [previewDistribution, setPreviewDistribution] = useState<TierDistribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [message, setMessage] = useState<{type: string; text: string} | null>(null);

  useEffect(() => {
    loadThresholds();
  }, [department]);

  const loadThresholds = async () => {
    try {
      setLoading(true);
      // Clear any stale cache to ensure fresh data
      localStorage.removeItem("cached_gpa_thresholds");
      
      const globalRes = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/global`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}` },
        cache: 'no-store' // Prevent browser caching
      });
      if (globalRes.ok) {
        const globalData = await globalRes.json();
        setGlobalThresholds(globalData.data);
      }
      if (department) {
        const deptRes = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/department/${encodeURIComponent(department)}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}` },
          cache: 'no-store' // Prevent browser caching
        });
        if (deptRes.ok) {
          const deptData = await deptRes.json();
          console.log('📥 [Settings] Department data loaded:', deptData.data);
          setUseCustomThresholds(deptData.data.useCustomThresholds);
          setDeptThresholds(deptData.data.thresholds);
          console.log('✅ [Settings] Set department thresholds:', deptData.data.thresholds);
          console.log('✅ [Settings] useCustomThresholds:', deptData.data.useCustomThresholds);
        } else {
          console.error('❌ [Settings] Failed to load department settings:', deptRes.status);
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
        // Reload thresholds immediately
        await loadThresholds();
      } else {
        showMessage("error", data.message || "Failed to update");
      }
    } catch (error) {
      showMessage("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveDepartmentThresholds = async () => {
    if (!department) return;
    try {
      setSaving(true);
      const payload = { useCustomThresholds, ...deptThresholds };
      console.log('💾 [Settings] Saving department thresholds:', payload);
      console.log('💾 [Settings] Department:', department);
      
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/department/${encodeURIComponent(department)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log('📥 [Settings] Save response:', data);
      
      if (res.ok) {
        showMessage("success", `Settings updated for ${department}`);
        // Force immediate refresh - clear ALL cache
        localStorage.removeItem("cached_gpa_thresholds");
        localStorage.setItem("gpa_thresholds_changed", Date.now().toString());
        // Dispatch multiple events to ensure all listeners catch it
        window.dispatchEvent(new Event("gpa_thresholds_changed"));
        window.dispatchEvent(new Event("refresh_gpa_thresholds"));
        // Reload thresholds immediately
        await loadThresholds();
        console.log('✅ [Settings] Thresholds reloaded after save');
      } else {
        console.error('❌ [Settings] Save failed:', data);
        showMessage("error", data.message || "Failed to update");
      }
    } catch (error) {
      console.error('❌ [Settings] Save error:', error);
      showMessage("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewTierDistribution = async () => {
    try {
      setLoading(true);
      // Use department thresholds if custom thresholds are enabled, otherwise use global
      const thresholds = useCustomThresholds ? deptThresholds : globalThresholds;
      
      console.log('🔍 [Settings] Previewing with thresholds:', thresholds);
      console.log('🔍 [Settings] Department:', department);
      console.log('🔍 [Settings] Use custom thresholds:', useCustomThresholds);
      
      const payload = { 
        ...thresholds, 
        department: department || null 
      };
      
      console.log('📤 [Settings] Sending preview request:', payload);
      
      const res = await fetch(`${API_BASE_URL}/settings/gpa-thresholds/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("supervise360_token") || localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      console.log('📥 [Settings] Preview response:', data);
      
      if (res.ok) {
        setPreviewDistribution(data.data.distribution);
        showMessage("success", "Preview generated successfully");
      } else {
        console.error('❌ [Settings] Preview failed:', data);
        showMessage("error", data.message || "Failed to preview");
      }
    } catch (error) {
      console.error('❌ [Settings] Preview error:', error);
      showMessage("error", error instanceof Error ? error.message : "Failed to preview");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const sendTestEmail = async () => {
    try {
      setSendingTestEmail(true);
      const emailToUse = testEmailTo.trim() || undefined;
      const res = await apiClient.sendTestEmail(emailToUse);
      if (res.success) {
        showMessage("success", res.message || "Test email sent! Check your inbox.");
      } else {
        showMessage("error", res.message || "Failed to send test email");
      }
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setSendingTestEmail(false);
    }
  };

  const validateThresholds = (thresholds: GpaThresholds): boolean => {
    return thresholds.high >= thresholds.medium && 
           thresholds.medium >= thresholds.low && 
           thresholds.low >= 0 && 
           thresholds.high <= 5.0;
  };

  const activeThresholds = department && useCustomThresholds ? deptThresholds : globalThresholds;
  const isValid = validateThresholds(activeThresholds);

  return (
    <MainLayout title="Settings">
      <div className="max-w-5xl mx-auto space-y-6">
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

        {/* Global Thresholds - Hidden for now, focusing on department-specific */}
        {false && isSuperAdmin && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <TrendingUp className="text-slate-700" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Global Thresholds</h2>
                  <p className="text-sm text-gray-600">Default for all departments</p>
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
                  <p className="text-xs text-gray-500 mt-1">GPA greater than or equal to this value</p>
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
                  <p className="text-xs text-gray-500 mt-1">GPA greater than or equal to this value</p>
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
                  <p className="text-xs text-gray-500 mt-1">GPA greater than or equal to this value</p>
                </div>
              </div>

              {!validateThresholds(globalThresholds) && (
                <div className="flex items-center gap-2 text-slate-700 text-sm bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <AlertCircle size={16} className="text-slate-500" />
                  <span>Invalid: Must satisfy 0 less than or equal to LOW less than or equal to MEDIUM less than or equal to HIGH less than or equal to 5.0</span>
                </div>
              )}

              <Button 
                onClick={saveGlobalThresholds} 
                disabled={saving || !validateThresholds(globalThresholds)}
                className="w-full"
              >
                {saving ? "Saving..." : "Save Global Thresholds"}
              </Button>
            </div>
          </Card>
        )}

        {department && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <TrendingUp className="text-slate-700" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Department Settings</h2>
                  <p className="text-sm text-gray-600">{department}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomThresholds}
                    onChange={(e) => setUseCustomThresholds(e.target.checked)}
                    className="w-4 h-4 text-slate-700 rounded focus:ring-2 focus:ring-slate-400"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    Use custom thresholds for {department}
                  </span>
                </label>
              </div>

              {useCustomThresholds && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">HIGH Tier</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        value={deptThresholds.high}
                        onChange={(e) => setDeptThresholds({ ...deptThresholds, high: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base font-medium text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">MEDIUM Tier</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        value={deptThresholds.medium}
                        onChange={(e) => setDeptThresholds({ ...deptThresholds, medium: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base font-medium text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">LOW Tier</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        value={deptThresholds.low}
                        onChange={(e) => setDeptThresholds({ ...deptThresholds, low: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-base font-medium text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  {!validateThresholds(deptThresholds) && (
                    <div className="flex items-center gap-2 text-slate-700 text-sm bg-slate-50 border border-slate-200 p-3 rounded-lg">
                      <AlertCircle size={16} className="text-slate-500" />
                      <span>Invalid: Must satisfy 0 less than or equal to LOW less than or equal to MEDIUM less than or equal to HIGH less than or equal to 5.0</span>
                    </div>
                  )}
                </>
              )}

              <Button 
                onClick={saveDepartmentThresholds} 
                disabled={saving || (useCustomThresholds && !validateThresholds(deptThresholds))}
                className="w-full"
              >
                {saving ? "Saving..." : "Save Department Settings"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="border border-slate-200">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-slate-700" size={22} />
              <h3 className="text-lg font-semibold text-gray-900">Preview Distribution</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">HIGH</div>
                <div className="text-xl font-semibold text-slate-900">greater than or equal to {activeThresholds.high}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">MEDIUM</div>
                <div className="text-xl font-semibold text-slate-900">greater than or equal to {activeThresholds.medium}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">LOW</div>
                <div className="text-xl font-semibold text-slate-900">greater than or equal to {activeThresholds.low}</div>
              </div>
            </div>

            <Button 
              onClick={previewTierDistribution} 
              disabled={loading || !isValid}
              variant="outline"
              className="w-full"
            >
              {loading ? "Loading..." : "Preview Student Distribution"}
            </Button>

            {previewDistribution && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-gray-900 mb-3">Current Distribution</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-semibold text-slate-900">{previewDistribution.HIGH}</div>
                    <div className="text-sm text-gray-600">HIGH</div>
                    <div className="text-xs text-gray-500">
                      {previewDistribution.total > 0 ? ((previewDistribution.HIGH / previewDistribution.total) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-semibold text-slate-900">{previewDistribution.MEDIUM}</div>
                    <div className="text-sm text-gray-600">MEDIUM</div>
                    <div className="text-xs text-gray-500">
                      {previewDistribution.total > 0 ? ((previewDistribution.MEDIUM / previewDistribution.total) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-semibold text-slate-900">{previewDistribution.LOW}</div>
                    <div className="text-sm text-gray-600">LOW</div>
                    <div className="text-xs text-gray-500">
                      {previewDistribution.total > 0 ? ((previewDistribution.LOW / previewDistribution.total) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center text-sm text-gray-600">
                  Total: {previewDistribution.total} students
                </div>
              </div>
            )}
          </div>
        </Card>

        {user?.role === "admin" && (
          <Card className="border border-slate-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="text-slate-700" size={22} />
                <h3 className="text-lg font-semibold text-gray-900">Email</h3>
              </div>
              <p className="text-sm text-slate-600">
                Send a test email to verify SMTP is configured correctly. Enter your real email below (your admin account may use a dummy address).
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="your-real-email@example.com"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent text-sm"
                />
                <Button
                  onClick={sendTestEmail}
                  disabled={sendingTestEmail || !testEmailTo.trim()}
                  variant="outline"
                  className="sm:w-auto"
                >
                  {sendingTestEmail ? "Sending..." : "Send test email"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}