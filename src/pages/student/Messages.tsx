import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MessageCircle, Send, Search, Users, Clock, 
  Paperclip, MoreVertical, Star, Archive 
} from 'lucide-react';

export function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading conversations
    setTimeout(() => {
      const mockConversations = [
        {
          id: 1,
          name: 'Dr. Jane Smith',
          role: 'Supervisor',
          avatar: 'JS',
          lastMessage: 'Great progress on the project! Keep it up.',
          timestamp: '2024-01-22 14:30',
          unread: 2,
          online: true
        },
        {
          id: 2,
          name: 'Group Alpha',
          role: 'Group Chat',
          avatar: 'GA',
          lastMessage: 'Alice: When should we meet for the next milestone?',
          timestamp: '2024-01-22 12:15',
          unread: 0,
          online: false
        },
        {
          id: 3,
          name: 'Alice Johnson',
          role: 'Team Member',
          avatar: 'AJ',
          lastMessage: 'I\'ve uploaded the database schema to our shared folder.',
          timestamp: '2024-01-21 16:45',
          unread: 1,
          online: true
        },
        {
          id: 4,
          name: 'Bob Wilson',
          role: 'Team Member',
          avatar: 'BW',
          lastMessage: 'Thanks for the code review feedback!',
          timestamp: '2024-01-21 10:20',
          unread: 0,
          online: false
        }
      ];

      const mockMessages = {
        1: [
          {
            id: 1,
            sender: 'Dr. Jane Smith',
            content: 'Hello! I\'ve reviewed your weekly report. Overall, excellent work on the project planning phase.',
            timestamp: '2024-01-22 14:25',
            isOwn: false
          },
          {
            id: 2,
            sender: 'You',
            content: 'Thank you, Dr. Smith! I\'m glad you found it comprehensive. Do you have any specific feedback for improvement?',
            timestamp: '2024-01-22 14:28',
            isOwn: true
          },
          {
            id: 3,
            sender: 'Dr. Jane Smith',
            content: 'Great progress on the project! Keep it up. I\'d like to see more technical details in your next report, particularly about the database design decisions.',
            timestamp: '2024-01-22 14:30',
            isOwn: false
          }
        ]
      };

      setConversations(mockConversations);
      setMessages(mockMessages);
      setSelectedConversation(mockConversations[0]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const message = {
      id: Date.now(),
      sender: 'You',
      content: newMessage,
      timestamp: new Date().toISOString(),
      isOwn: true
    };

    setMessages(prev => ({
      ...prev,
      [selectedConversation.id]: [...(prev[selectedConversation.id] || []), message]
    }));

    setNewMessage('');
  };

  if (loading) {
    return (
      <MainLayout title="Messages">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading messages...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Messages">
      <div className="h-[calc(100vh-12rem)]">
        <Card className="h-full p-0 overflow-hidden">
          <div className="flex h-full">
            {/* Conversations List */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#1a237e]">Messages</h2>
                  <Button size="sm" variant="outline">
                    <Users className="mr-2" size={14} />
                    New Chat
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation?.id === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">{conversation.avatar}</span>
                        </div>
                        {conversation.online && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900 truncate">{conversation.name}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(conversation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{conversation.role}</p>
                        <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                      </div>
                      {conversation.unread > 0 && (
                        <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                          {conversation.unread}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">{selectedConversation.avatar}</span>
                          </div>
                          {selectedConversation.online && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{selectedConversation.name}</h3>
                          <p className="text-sm text-gray-600">
                            {selectedConversation.online ? 'Online' : 'Last seen recently'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Star size={16} />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Archive size={16} />
                        </Button>
                        <Button size="sm" variant="outline">
                          <MoreVertical size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {(messages[selectedConversation.id] || []).map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.isOwn
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.isOwn ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline">
                        <Paperclip size={16} />
                      </Button>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type your message..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                        <Send size={16} />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-gray-600">Choose a conversation from the list to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}