import { useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User, Mail, Phone, MapPin, Calendar, BookOpen, 
  Edit, Save, X, Camera, Shield, Bell, Key 
} from 'lucide-react';

export function Profile() {
  const { user, student } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: '+1 (555) 123-4567',
    address: '123 University Ave, College Town, ST 12345',
    bio: 'Computer Science student passionate about AI and machine learning. Currently working on an intelligent student management system as part of my final year project.',
    interests: 'Machine Learning, Web Development, Data Science, Mobile Apps',
    linkedIn: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe'
  });

  const handleSave = () => {
    // Here you would typically save to backend
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      email: user?.email || '',
      phone: '+1 (555) 123-4567',
      address: '123 University Ave, College Town, ST 12345',
      bio: 'Computer Science student passionate about AI and machine learning.',
      interests: 'Machine Learning, Web Development, Data Science',
      linkedIn: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe'
    });
    setIsEditing(false);
  };

  return (
    <MainLayout title="Profile">
      <div className="space-y-6">
        {/* Profile Header */}
        <Card>
          <div className="flex items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Camera size={16} />
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#1a237e]">
                    {user?.first_name} {user?.last_name}
                  </h2>
                  <p className="text-gray-600">Computer Science Student</p>
                  <p className="text-sm text-gray-500">Matric: {student?.matric_number}</p>
                </div>
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant={isEditing ? "outline" : "default"}
                >
                  {isEditing ? (
                    <>
                      <X className="mr-2" size={16} />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2" size={16} />
                      Edit Profile
                    </>
                  )}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail size={16} />
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen size={16} />
                  <span>GPA: {student?.gpa?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} />
                  <span>Joined: {new Date(user?.created_at || '').toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1a237e]">Personal Information</h3>
              {isEditing && (
                <Button onClick={handleSave} size="sm">
                  <Save className="mr-2" size={14} />
                  Save Changes
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{formData.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{formData.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{formData.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{formData.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{formData.address}</p>
                )}
              </div>
            </div>
          </Card>
          {/* Academic Information */}
          <Card>
            <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Academic Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matric Number
                  </label>
                  <p className="text-gray-900">{student?.matric_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current GPA
                  </label>
                  <p className="text-gray-900 font-semibold">{student?.gpa?.toFixed(2) || 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <p className="text-gray-900">{user?.department}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program
                </label>
                <p className="text-gray-900">{student?.program || 'Bachelor of Computer Science'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Year
                </label>
                <p className="text-gray-900">{student?.academic_year || '2024/2025'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GPA Tier
                </label>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  student?.gpa_tier === 'HIGH' ? 'bg-green-100 text-green-800' :
                  student?.gpa_tier === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {student?.gpa_tier || 'N/A'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Bio and Interests */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">About Me</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              {isEditing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-gray-700">{formData.bio}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interests & Skills
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.interests}
                  onChange={(e) => setFormData({...formData, interests: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Machine Learning, Web Development, Data Science"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.interests.split(',').map((interest, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {interest.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Social Links */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Social Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn Profile
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.linkedIn}
                  onChange={(e) => setFormData({...formData, linkedIn: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              ) : (
                <a href={formData.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {formData.linkedIn}
                </a>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Profile
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.github}
                  onChange={(e) => setFormData({...formData, github: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://github.com/yourusername"
                />
              ) : (
                <a href={formData.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {formData.github}
                </a>
              )}
            </div>
          </div>
        </Card>

        {/* Account Settings */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Account Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="text-gray-600" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">Change Password</h4>
                  <p className="text-sm text-gray-600">Update your account password</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <Key className="mr-2" size={14} />
                Change
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="text-gray-600" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">Notification Preferences</h4>
                  <p className="text-sm text-gray-600">Manage your notification settings</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <User className="text-gray-600" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">Privacy Settings</h4>
                  <p className="text-sm text-gray-600">Control who can see your information</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </div>
          </div>
        </Card>

        {isEditing && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancel}>
              Cancel Changes
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2" size={16} />
              Save Profile
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}