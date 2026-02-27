import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Upload, Users, Building, FileText, AlertCircle, Calendar, CheckCircle, Download, Trash2, ChevronDown, FileSpreadsheet, File, Share2 } from 'lucide-react';
import { parseCSV, readFileAsText, generateCSV } from '../../lib/csv-parser';
import { downloadAllocationAsPDF, downloadAllocationAsWord } from '../../lib/export-utils';
import { apiClient } from '../../lib/api';
import { useDepartment } from '../../contexts/DepartmentContext';

const STORAGE_KEY = 'supervise360_defense_scheduling';
const ALLOCATION_COLUMNS_PER_ROW = 9;

function loadFromStorage() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const data = JSON.parse(s);
    if (data && (data.staffRows?.length > 0 || data.venueRows?.length > 0 || data.allocations?.length > 0)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(data: { staffRows: any[]; venueRows: any[]; groupRanges: any[]; allocations: any[] | null; excludedCount: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save defense scheduling to storage', e);
  }
}

interface GroupRange {
  venue_index: number;
  department: string;
  start: number;
  end: number;
}

interface AllocationColumn {
  venue: string;
  groupRange: string;
  assessors: string[];
}

export function DefenseScheduling() {
  const { userDepartment, isSystemAdmin } = useDepartment();
  const [staffRows, setStaffRows] = useState<any[]>(() => {
    const d = loadFromStorage();
    return d?.staffRows ?? [];
  });
  const [venueRows, setVenueRows] = useState<any[]>(() => {
    const d = loadFromStorage();
    return d?.venueRows ?? [];
  });
  const [groupRanges, setGroupRanges] = useState<GroupRange[]>(() => {
    const d = loadFromStorage();
    return d?.groupRanges ?? [];
  });
  const [allocations, setAllocations] = useState<AllocationColumn[] | null>(() => {
    const d = loadFromStorage();
    return d?.allocations ?? null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [excludedCount, setExcludedCount] = useState(() => {
    const d = loadFromStorage();
    return d?.excludedCount ?? 0;
  });
  const [activeTab, setActiveTab] = useState<'setup' | 'allocation'>('setup');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const staffInputRef = useRef<HTMLInputElement>(null);
  const venueInputRef = useRef<HTMLInputElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    saveToStorage({
      staffRows,
      venueRows,
      groupRanges,
      allocations,
      excludedCount
    });
  }, [staffRows, venueRows, groupRanges, allocations, excludedCount]);

  const handleClearAll = () => {
    setStaffRows([]);
    setVenueRows([]);
    setGroupRanges([]);
    setAllocations(null);
    setExcludedCount(0);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const handleStaffUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAllocations(null);
    try {
      const text = await readFileAsText(file);
      const parsed = parseCSV(text);
      setStaffRows(parsed.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse staff CSV');
      setStaffRows([]);
    }
    e.target.value = '';
  };

  const handleVenueUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAllocations(null);
    try {
      const text = await readFileAsText(file);
      const parsed = parseCSV(text);
      setVenueRows(parsed.rows);
      setGroupRanges(
        parsed.rows.map((_, i) => ({
          venue_index: i,
          department: '',
          start: 1,
          end: 1
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse venue CSV');
      setVenueRows([]);
      setGroupRanges([]);
    }
    e.target.value = '';
  };

  const downloadAllocations = () => {
    if (!allocations || allocations.length === 0) return;
    const maxAssessors = Math.max(...allocations.map(c => c.assessors.length), 1);
    const assessorCols = Array.from({ length: maxAssessors }, (_, i) => `Assessor ${i + 1}`);
    const rows = allocations.map(col => {
      const row: Record<string, string> = {
        Venue: col.venue,
        'Group Range': col.groupRange || '',
        ...Object.fromEntries(assessorCols.map((key, i) => [key, col.assessors[i] ?? '']))
      };
      return row;
    });
    generateCSV(rows, `defense_allocations_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const updateGroupRange = (venueIndex: number, field: 'department' | 'start' | 'end', value: string | number) => {
    setGroupRanges(prev => {
      const next = [...prev];
      const idx = next.findIndex(r => r.venue_index === venueIndex);
      if (idx >= 0) {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    setError(null);
    setAllocations(null);
    if (staffRows.length === 0) {
      setError('Please upload staff CSV first.');
      return;
    }
    if (venueRows.length === 0) {
      setError('Please upload venue CSV first.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.allocateDefenseScheduling({
        staff: staffRows,
        venues: venueRows,
        groupRanges
      });
      if (res.success && res.data) {
        setExcludedCount(res.data.excludedCount ?? 0);
        setActiveTab('allocation');
        const cols: AllocationColumn[] = (res.data.allocations || []).map((a: any) => {
          const venueName = a.venue?.venue_name || '';
          const gr = a.groupRange;
          const rangeStr = gr ? `${gr.department} Grp (${gr.start}–${gr.end})` : '';
          const assessors = (a.team?.members || []).map((m: any) => m.name || '');
          return {
            venue: venueName,
            groupRange: rangeStr,
            assessors
          };
        });
        setAllocations(cols);
      } else {
        setError(res.message || res.error || 'Allocation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allocation failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToStudents = async () => {
    if (!allocations || allocations.length === 0) return;
    const hasRanges = groupRanges.some(r => r.department && r.start && r.end);
    if (!hasRanges) {
      alert('Please fill in Department, Group Start, and Group End for each venue in the Setup tab.');
      return;
    }
    setPublishing(true);
    try {
      const res = await apiClient.publishDefenseAllocations({
        allocations: allocations.map(a => ({ venue: a.venue, assessors: a.assessors })),
        groupRanges
      });
      if (res.success) {
        alert('Defense schedule published! Students and supervisors can now see their venue and assessors.');
      } else {
        alert(res.message || 'Failed to publish');
      }
    } catch (e) {
      alert('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const maxAssessors = allocations ? Math.max(...allocations.map(c => c.assessors.length), 1) : 0;
  const configuredRanges = groupRanges.filter(r => r.department && r.start && r.end).length;

  const tabs = [
    { id: 'setup' as const, label: 'Setup', icon: Upload },
    { id: 'allocation' as const, label: 'Allocation', icon: Calendar }
  ];

  return (
    <MainLayout title="Defense Scheduling">
      <div className="space-y-4">
        {/* Header */}
        <Card className="border border-slate-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Defense Scheduling</h2>
              <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
                <Building size={14} />
                {isSystemAdmin ? 'All Departments' : userDepartment}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {staffRows.length > 0 || venueRows.length > 0 || (allocations && allocations.length > 0) ? (
                <Button variant="outline" size="sm" onClick={handleClearAll} className="text-red-600 hover:text-red-700 hover:border-red-300">
                  <Trash2 size={14} className="mr-1.5" />
                  Clear All
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={loading || staffRows.length === 0 || venueRows.length === 0}
                className="bg-[#1F7A8C] hover:bg-[#2a8a9c] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Allocation'}
              </Button>
            </div>
          </div>
          <input ref={staffInputRef} type="file" accept=".csv" onChange={handleStaffUpload} className="hidden" />
          <input ref={venueInputRef} type="file" accept=".csv" onChange={handleVenueUpload} className="hidden" />
        </Card>

        {error && (
          <Card className="border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{staffRows.length}</p>
                <p className="text-sm text-slate-500">Staff Loaded</p>
              </div>
            </div>
          </Card>
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1F7A8C]/10 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-[#1F7A8C]" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{venueRows.length}</p>
                <p className="text-sm text-slate-500">Venues</p>
              </div>
            </div>
          </Card>
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1F7A8C]/10 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#1F7A8C]" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{configuredRanges}</p>
                <p className="text-sm text-slate-500">Group Ranges</p>
              </div>
            </div>
          </Card>
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1F7A8C]/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#1F7A8C]" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{allocations?.length ?? 0}</p>
                <p className="text-sm text-slate-500">Allocations</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === id ? 'bg-white border border-slate-200 border-b-0 text-slate-900 -mb-px' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={16} />
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Setup */}
        {activeTab === 'setup' && (
          <div className="space-y-4">
            <Card className="border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                1. Upload Staff (Assessors) CSV
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Required columns: staff_id, name, rank. Ranks HOD and Dean are excluded from assessor teams.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={() => staffInputRef.current?.click()} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Staff CSV
                </Button>
                {staffRows.length > 0 && (
                  <span className="text-sm text-slate-600">
                    {staffRows.length} staff loaded
                  </span>
                )}
              </div>
            </Card>

            <Card className="border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-slate-600" />
                2. Upload Venues CSV
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Required columns: venue_id, venue_name. Teams are spread across all venues.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={() => venueInputRef.current?.click()} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Venues CSV
                </Button>
                {venueRows.length > 0 && (
                  <span className="text-sm text-slate-600">
                    {venueRows.length} venues loaded
                  </span>
                )}
              </div>
            </Card>

            {venueRows.length > 0 && (
              <Card className="border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  3. Student Group Ranges (per venue)
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Assign department and group range (start–end) to each venue. Ranges must not overlap within a department.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Venue</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Department</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Group Start</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Group End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venueRows.map((row, i) => {
                        const venueName = row.venue_name ?? row['venue name'] ?? row[Object.keys(row)[1]] ?? `Venue ${i + 1}`;
                        const r = groupRanges.find(gr => gr.venue_index === i) || {
                          venue_index: i,
                          department: '',
                          start: 1,
                          end: 1
                        };
                        return (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-2 px-3 text-slate-900">{venueName}</td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={r.department}
                                onChange={e => updateGroupRange(i, 'department', e.target.value)}
                                placeholder="e.g. IT"
                                className="w-full max-w-[120px] px-2 py-1.5 border border-slate-200 rounded text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={1}
                                value={r.start}
                                onChange={e => updateGroupRange(i, 'start', parseInt(e.target.value, 10) || 1)}
                                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={1}
                                value={r.end}
                                onChange={e => updateGroupRange(i, 'end', parseInt(e.target.value, 10) || 1)}
                                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-slate-900"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {staffRows.length > 0 && venueRows.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-700">Click &quot;Generate Allocation&quot; above to create the defense schedule. Data persists until you clear it.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Allocation */}
        {activeTab === 'allocation' && (
          <Card className="border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Final Allocation</h3>
              <div className="flex items-center gap-3">
                {allocations && allocations.length > 0 && (
                  <>
                    <span className="text-sm text-slate-500">{allocations.length} allocations</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePublishToStudents}
                      disabled={publishing}
                      className="text-[#1F7A8C] hover:text-[#2a8a9c] hover:border-[#1F7A8C]"
                    >
                      {publishing ? (
                        <span className="flex items-center gap-1.5">
                          <span className="animate-spin rounded-full h-3 w-3 border-2 border-[#1F7A8C] border-t-transparent" />
                          Publishing...
                        </span>
                      ) : (
                        <>
                          <Share2 size={14} className="mr-1.5" />
                          Publish to Students
                        </>
                      )}
                    </Button>
                    <div className="relative" ref={exportDropdownRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExportDropdownOpen(o => !o)}
                      >
                        <Download size={14} className="mr-1.5" />
                        Export
                        <ChevronDown size={14} className={`ml-1.5 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
                      </Button>
                      {exportDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => { downloadAllocations(); setExportDropdownOpen(false); }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                            <FileSpreadsheet size={14} className="flex-shrink-0" />
                            CSV
                          </button>
                          <button
                            onClick={() => { downloadAllocationAsPDF(allocations, excludedCount); setExportDropdownOpen(false); }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                            <FileText size={14} className="flex-shrink-0" />
                            PDF
                          </button>
                          <button
                            onClick={() => { downloadAllocationAsWord(allocations, excludedCount); setExportDropdownOpen(false); }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                            <File size={14} className="flex-shrink-0" />
                            Word
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {allocations && allocations.length > 0 ? (
              <>
                {excludedCount > 0 && (
                  <p className="text-sm text-slate-600 mb-4">
                    {excludedCount} staff excluded (HOD/Dean).
                  </p>
                )}
                <div className="space-y-6">
                  {(() => {
                    const chunks: AllocationColumn[][] = [];
                    for (let i = 0; i < allocations.length; i += ALLOCATION_COLUMNS_PER_ROW) {
                      chunks.push(allocations.slice(i, i + ALLOCATION_COLUMNS_PER_ROW));
                    }
                    return chunks.map((chunk, chunkIdx) => (
                      <div key={chunkIdx} className="overflow-x-auto">
                        {chunks.length > 1 && (
                          <p className="text-xs text-slate-500 mb-2">
                            Venues {chunkIdx * ALLOCATION_COLUMNS_PER_ROW + 1}–{chunkIdx * ALLOCATION_COLUMNS_PER_ROW + chunk.length}
                          </p>
                        )}
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              {chunk.map((col, i) => (
                                <th
                                  key={i}
                                  className="border border-slate-200 p-3 bg-slate-50 text-left font-medium text-slate-900 align-top min-w-[140px]"
                                >
                                  <div>{col.venue}</div>
                                  {col.groupRange && (
                                    <div className="text-slate-600 font-normal mt-1">{col.groupRange}</div>
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: maxAssessors }).map((_, rowIdx) => (
                              <tr key={rowIdx}>
                                {chunk.map((col, colIdx) => (
                                  <td
                                    key={colIdx}
                                    className="border border-slate-200 p-2 text-slate-800 align-top"
                                  >
                                    {col.assessors[rowIdx] ?? '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="font-medium">No allocation yet</p>
                <p className="text-sm mt-1">Upload staff and venues, configure group ranges, then generate allocation in the Setup tab</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('setup')}>Go to Setup</Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
