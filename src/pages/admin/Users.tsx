import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { Users as UsersIcon, UserPlus, Search, Edit, Trash2, Mail, Phone, MoreVertical } from 'lucide-react';

export function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [studentDetails, setStudentDetails] = useState<Record<string, any>>({});
  const [supervisorDetails, setSupervisorDetails] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const [usersRes, studentsRes, supervisorsRes] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getStudents(),
        apiClient.getSupervisors()
      ]);

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }
      if (studentsRes.success && studentsRes.data) {
        const map: Record<string, any> = {};
        (studentsRes.data as any[]).forEach(student => {
          map[student.email] = student;
        });
        setStudentDetails(map);
      }
      if (supervisorsRes.success && supervisorsRes.data) {
        const map: Record<string, any> = {};
        (supervisorsRes.data as any[]).forEach(supervisor => {
          map[supervisor.email] = supervisor;
        });
        setSupervisorDetails(map);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const name = `${user.first_name} ${user.last_name}`.trim();
    const matchesFilter = filter === 'all' || user.role === filter;
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getRoleColor = (role: string) => {
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
              <option value="admin">Admins</option>
            </select>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredUsers.map((user) => {
            const name = `${user.first_name} ${user.last_name}`.trim();
            const student = studentDetails[user.email];
            const supervisor = supervisorDetails[user.email];
            return (
              <Card key={user.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                      <span className="text-xs text-gray-500">{user.department || '—'}</span>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} />
                    <span>{user.email}</span>
                  </div>
                  {student?.matric_number && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UsersIcon size={14} />
                      <span>Matric: {student.matric_number}</span>
                    </div>
                  )}
                  {student?.gpa && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UsersIcon size={14} />
                      <span>GPA: {student.gpa}</span>
                    </div>
                  )}
                  {supervisor?.current_load != null && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UsersIcon size={14} />
                      <span>Groups: {supervisor.current_load}/{supervisor.max_capacity}</span>
                    </div>
                  )}
                  {supervisor?.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={14} />
                      <span>{supervisor.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Edit size={14} className="mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
