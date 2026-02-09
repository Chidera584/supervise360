import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users as UsersIcon, UserPlus, Search, Filter, 
  Edit, Trash2, Mail, Phone, MoreVertical 
} from 'lucide-react';

export function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setUsers([
        {
          id: 1,
          name: 'John Student',
          email: 'john@student.edu',
          role: 'student',
          department: 'Computer Science',
          status: 'active',
          lastLogin: '2024-01-22',
          matric: 'ST2024001',
          gpa: 3.75
        },
        {
          id: 2,
          name: 'Dr. Jane Smith',
          email: 'jane.smith@university.edu',
          role: 'supervisor',
          department: 'Computer Science',
          status: 'active',
          lastLogin: '2024-01-22',
          groups: 3,
          capacity: 7
        },
        {
          id: 3,
          name: 'Alice Johnson',
          email: 'alice@student.edu',
          role: 'student',
          department: 'Software Engineering',
          status: 'active',
          lastLogin: '2024-01-21',
          matric: 'ST2024002',
          gpa: 3.82
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesFilter = filter === 'all' || user.role === filter;
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'student': return 'text-blue-600 bg-blue-100';
      case 'supervisor': return 'text-green-600 bg-green-100';
      case 'admin': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <MainLayout title="Users">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading users...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Users">
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">User Management</h2>
              <p className="text-gray-600 mt-1">Manage students, supervisors, and administrators</p>
            </div>
            <Button>
              <UserPlus className="mr-2" size={16} />
              Add New User
            </Button>
          </div>
        </Card>

        {/* Filters and Search */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              <option value="student">Students</option>
              <option value="supervisor">Supervisors</option>
              <option value="admin">Administrators</option>
            </select>
            <Button variant="outline">
              <Filter className="mr-2" size={16} />
              More Filters
            </Button>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <UsersIcon className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-[#1a237e]">{users.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UsersIcon className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Students</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {users.filter(u => u.role === 'student').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <UsersIcon className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Supervisors</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {users.filter(u => u.role === 'supervisor').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <UsersIcon className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Today</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {users.filter(u => u.lastLogin === '2024-01-22').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">
            {filter === 'all' ? 'All Users' : 
             filter.charAt(0).toUpperCase() + filter.slice(1) + 's'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Department</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Last Login</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          {user.matric && (
                            <p className="text-xs text-gray-500">Matric: {user.matric}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{user.department}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Edit size={14} />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail size={14} />
                        </Button>
                        <Button size="sm" variant="outline">
                          <MoreVertical size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}