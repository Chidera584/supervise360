import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { BookOpen, Plus, Eye, BarChart3 } from 'lucide-react';

export function Projects() {
  return (
    <MainLayout title="Projects">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">Project Management</h2>
              <p className="text-gray-600 mt-1">Monitor all student projects and progress</p>
            </div>
            <Button>
              <Plus className="mr-2" size={16} />
              Add Project Template
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold text-[#1a237e]">0%</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Eye className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Under Review</p>
                <p className="text-2xl font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
            <p className="text-gray-600 mb-6">
              Projects will appear here once groups are assigned and start working on their assignments.
            </p>
            <Button variant="outline" disabled>
              <Plus className="mr-2" size={16} />
              Create Project
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}