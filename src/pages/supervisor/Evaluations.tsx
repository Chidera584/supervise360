import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, Star, Clock, CheckCircle, Eye, 
  Download, MessageCircle, Calendar, Filter 
} from 'lucide-react';

export function Evaluations() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setEvaluations([
        {
          id: 1,
          groupName: 'Group Alpha',
          studentName: 'John Student',
          reportTitle: 'Weekly Progress Report #3',
          submittedDate: '2024-01-22',
          dueDate: '2024-01-21',
          status: 'pending',
          type: 'Weekly Report',
          grade: null,
          feedback: null
        },
        {
          id: 2,
          groupName: 'Group Beta',
          studentName: 'Sarah Chen',
          reportTitle: 'System Design Document',
          submittedDate: '2024-01-20',
          dueDate: '2024-01-20',
          status: 'graded',
          type: 'Technical Report',
          grade: 'A-',
          feedback: 'Excellent technical analysis and clear documentation.'
        },
        {
          id: 3,
          groupName: 'Group Alpha',
          studentName: 'Alice Johnson',
          reportTitle: 'Monthly Progress Report - January',
          submittedDate: '2024-01-19',
          dueDate: '2024-01-19',
          status: 'graded',
          type: 'Monthly Report',
          grade: 'B+',
          feedback: 'Good progress overview. Consider adding more technical details.'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredEvaluations = evaluations.filter(evaluation => {
    if (filter === 'all') return true;
    return evaluation.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'graded': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <MainLayout title="Evaluations">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading evaluations...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Evaluations">
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">Student Evaluations</h2>
              <p className="text-gray-600 mt-1">Review and grade student submissions</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Submissions</option>
                <option value="pending">Pending Review</option>
                <option value="graded">Graded</option>
              </select>
              <Button variant="outline">
                <Filter className="mr-2" size={16} />
                More Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {evaluations.filter(e => e.status === 'pending').length}
                </p>
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
                  {evaluations.filter(e => e.status === 'graded').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold text-[#1a237e]">{evaluations.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Star className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Grade</p>
                <p className="text-2xl font-bold text-[#1a237e]">B+</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Evaluations List */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">
            {filter === 'all' ? 'All Submissions' : 
             filter === 'pending' ? 'Pending Reviews' : 'Graded Submissions'}
          </h3>
          <div className="space-y-4">
            {filteredEvaluations.map((evaluation) => (
              <div key={evaluation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{evaluation.reportTitle}</h4>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                        {evaluation.status.charAt(0).toUpperCase() + evaluation.status.slice(1)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span>{evaluation.groupName}</span>
                      <span>•</span>
                      <span>{evaluation.studentName}</span>
                      <span>•</span>
                      <span>{evaluation.type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Submitted: {new Date(evaluation.submittedDate).toLocaleDateString()}</span>
                      <span>Due: {new Date(evaluation.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {evaluation.grade && (
                      <div className="text-center mr-4">
                        <div className="text-lg font-bold text-green-600">{evaluation.grade}</div>
                        <div className="text-xs text-gray-500">Grade</div>
                      </div>
                    )}
                    <Button size="sm" variant="outline">
                      <Eye className="mr-2" size={14} />
                      Review
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="mr-2" size={14} />
                      Download
                    </Button>
                  </div>
                </div>
                
                {evaluation.feedback && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <h5 className="text-sm font-medium text-green-900 mb-1">Your Feedback</h5>
                    <p className="text-sm text-green-800">{evaluation.feedback}</p>
                  </div>
                )}

                {evaluation.status === 'pending' && (
                  <div className="mt-3 flex items-center gap-3 pt-3 border-t border-gray-200">
                    <Button size="sm">
                      <Star className="mr-2" size={14} />
                      Grade & Provide Feedback
                    </Button>
                    <Button size="sm" variant="outline">
                      <MessageCircle className="mr-2" size={14} />
                      Message Student
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}