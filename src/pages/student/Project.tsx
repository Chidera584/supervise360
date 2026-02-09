import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BookOpen, Calendar, Clock, CheckCircle, AlertCircle, 
  FileText, Upload, Download, Users, Target, BarChart3 
} from 'lucide-react';

export function Project() {
  const { user, student } = useAuth();
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading project data
    setTimeout(() => {
      if (student?.group_id) {
        setProjectData({
          title: 'AI-Powered Student Management System',
          description: 'Developing an intelligent system to help universities manage student data, track academic progress, and provide insights for better educational outcomes.',
          status: 'In Progress',
          progress: 35,
          startDate: '2024-01-15',
          deadline: '2024-06-15',
          supervisor: 'Dr. Jane Smith',
          objectives: [
            'Design and implement a user-friendly interface',
            'Develop machine learning algorithms for predictive analytics',
            'Create a robust database system',
            'Implement security and privacy measures',
            'Conduct thorough testing and validation'
          ],
          milestones: [
            { name: 'Project Planning', status: 'completed', date: '2024-01-20', progress: 100 },
            { name: 'Requirements Analysis', status: 'completed', date: '2024-02-05', progress: 100 },
            { name: 'System Design', status: 'in-progress', date: '2024-02-25', progress: 70 },
            { name: 'Implementation Phase 1', status: 'pending', date: '2024-03-15', progress: 0 },
            { name: 'Testing & Validation', status: 'pending', date: '2024-05-01', progress: 0 },
            { name: 'Final Presentation', status: 'pending', date: '2024-06-10', progress: 0 }
          ],
          resources: [
            { name: 'Project Proposal.pdf', type: 'document', size: '2.3 MB', date: '2024-01-15' },
            { name: 'System Architecture.png', type: 'image', size: '1.8 MB', date: '2024-02-01' },
            { name: 'Database Schema.sql', type: 'code', size: '45 KB', date: '2024-02-10' },
            { name: 'UI Mockups.fig', type: 'design', size: '12.5 MB', date: '2024-02-15' }
          ]
        });
      }
      setLoading(false);
    }, 1000);
  }, [student]);

  if (loading) {
    return (
      <MainLayout title="Project">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading project information...</div>
        </div>
      </MainLayout>
    );
  }
  if (!student?.group_id || !projectData) {
    return (
      <MainLayout title="Project">
        <div className="space-y-6">
          <Card>
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Project Assigned</h3>
              <p className="text-gray-600 mb-6">
                You need to be assigned to a group before you can access project information.
              </p>
              <Button variant="outline">Contact Supervisor</Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-green-600" />;
      case 'in-progress': return <Clock size={16} className="text-blue-600" />;
      case 'pending': return <AlertCircle size={16} className="text-gray-600" />;
      default: return <AlertCircle size={16} className="text-gray-600" />;
    }
  };

  return (
    <MainLayout title="Project">
      <div className="space-y-6">
        {/* Project Overview */}
        <Card>
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-[#1a237e] mb-2">{projectData.title}</h2>
              <p className="text-gray-600 mb-4">{projectData.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Supervisor: {projectData.supervisor}</span>
                <span>•</span>
                <span>Started: {new Date(projectData.startDate).toLocaleDateString()}</span>
                <span>•</span>
                <span>Deadline: {new Date(projectData.deadline).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(projectData.status.toLowerCase().replace(' ', '-'))}`}>
                {projectData.status}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Overall Progress</span>
              <span>{projectData.progress}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full">
              <div
                className="h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                style={{ width: `${projectData.progress}%` }}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button>
              <Upload className="mr-2" size={16} />
              Upload File
            </Button>
            <Button variant="outline">
              <Users className="mr-2" size={16} />
              Team Collaboration
            </Button>
            <Button variant="outline">
              <BarChart3 className="mr-2" size={16} />
              View Analytics
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Objectives */}
          <Card>
            <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Project Objectives</h3>
            <div className="space-y-3">
              {projectData.objectives.map((objective, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Target size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{objective}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Project Resources */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1a237e]">Project Resources</h3>
              <Button size="sm" variant="outline">
                <Upload className="mr-2" size={14} />
                Add File
              </Button>
            </div>
            <div className="space-y-3">
              {projectData.resources.map((resource, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-gray-600" />
                    <div>
                      <p className="font-medium text-sm">{resource.name}</p>
                      <p className="text-xs text-gray-600">{resource.size} • {resource.date}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Download size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Project Milestones */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Project Milestones</h3>
          <div className="space-y-4">
            {projectData.milestones.map((milestone, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-shrink-0">
                    {getStatusIcon(milestone.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{milestone.name}</h4>
                      <span className="text-sm text-gray-600">
                        {new Date(milestone.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div
                            className={`h-2 rounded-full ${
                              milestone.status === 'completed' ? 'bg-green-500' :
                              milestone.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${milestone.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-600 min-w-[3rem]">
                        {milestone.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}