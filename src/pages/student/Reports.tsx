import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, Upload, Calendar, Clock, CheckCircle, 
  AlertTriangle, Download, Eye, Edit, Plus 
} from 'lucide-react';

export function Reports() {
  const { user, student } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    // Simulate loading reports data
    setTimeout(() => {
      setReports([
        {
          id: 1,
          title: 'Weekly Progress Report #1',
          type: 'Weekly Report',
          status: 'submitted',
          submittedDate: '2024-01-22',
          dueDate: '2024-01-21',
          grade: 'A',
          feedback: 'Excellent progress on the initial planning phase. Keep up the good work!',
          fileSize: '2.3 MB'
        },
        {
          id: 2,
          title: 'Monthly Progress Report - January',
          type: 'Monthly Report',
          status: 'graded',
          submittedDate: '2024-01-30',
          dueDate: '2024-01-31',
          grade: 'B+',
          feedback: 'Good analysis of requirements. Consider adding more technical details in the next report.',
          fileSize: '4.1 MB'
        },
        {
          id: 3,
          title: 'Weekly Progress Report #2',
          type: 'Weekly Report',
          status: 'overdue',
          submittedDate: null,
          dueDate: '2024-02-05',
          grade: null,
          feedback: null,
          fileSize: null
        },
        {
          id: 4,
          title: 'System Design Document',
          type: 'Technical Report',
          status: 'draft',
          submittedDate: null,
          dueDate: '2024-02-15',
          grade: null,
          feedback: null,
          fileSize: '1.8 MB'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <MainLayout title="Reports">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading reports...</div>
        </div>
      </MainLayout>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'text-blue-600 bg-blue-100';
      case 'graded': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'draft': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted': return <Clock size={16} className="text-blue-600" />;
      case 'graded': return <CheckCircle size={16} className="text-green-600" />;
      case 'overdue': return <AlertTriangle size={16} className="text-red-600" />;
      case 'draft': return <Edit size={16} className="text-yellow-600" />;
      default: return <FileText size={16} className="text-gray-600" />;
    }
  };

  return (
    <MainLayout title="Reports">
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">My Reports</h2>
              <p className="text-gray-600 mt-1">
                Track your progress reports and submissions
              </p>
            </div>
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="mr-2" size={16} />
              New Report
            </Button>
          </div>
        </Card>
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-[#1a237e]">{reports.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Graded</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {reports.filter(r => r.status === 'graded').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {reports.filter(r => r.status === 'submitted').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {reports.filter(r => r.status === 'overdue').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Reports List */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">All Reports</h3>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{report.title}</h4>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {getStatusIcon(report.status)}
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{report.type}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Due: {new Date(report.dueDate).toLocaleDateString()}</span>
                      {report.submittedDate && (
                        <span>Submitted: {new Date(report.submittedDate).toLocaleDateString()}</span>
                      )}
                      {report.fileSize && <span>Size: {report.fileSize}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.grade && (
                      <div className="text-center mr-4">
                        <div className="text-lg font-bold text-green-600">{report.grade}</div>
                        <div className="text-xs text-gray-500">Grade</div>
                      </div>
                    )}
                    <Button size="sm" variant="outline">
                      <Eye className="mr-2" size={14} />
                      View
                    </Button>
                    {report.status === 'graded' && (
                      <Button size="sm" variant="outline">
                        <Download className="mr-2" size={14} />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
                
                {report.feedback && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="text-sm font-medium text-blue-900 mb-1">Supervisor Feedback</h5>
                    <p className="text-sm text-blue-800">{report.feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Upload Guidelines */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Report Guidelines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Weekly Reports</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Submit every Monday by 11:59 PM</li>
                <li>• Include progress summary and challenges</li>
                <li>• Maximum 2 pages, PDF format</li>
                <li>• Use the provided template</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Monthly Reports</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Submit by the last day of each month</li>
                <li>• Comprehensive progress analysis</li>
                <li>• Include charts and metrics</li>
                <li>• 5-10 pages recommended</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Upload New Report</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Title
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter report title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Type
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Weekly Report</option>
                    <option>Monthly Report</option>
                    <option>Technical Report</option>
                    <option>Final Report</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag and drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOC, DOCX up to 10MB
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button className="flex-1">Upload Report</Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}