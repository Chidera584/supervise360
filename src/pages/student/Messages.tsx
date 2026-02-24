import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { Send, Inbox, Mail, ChevronDown, ChevronUp, Trash2, Reply } from 'lucide-react';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';

interface Contact {
  id: number;
  name: string;
  email: string;
  label?: string;
  type?: 'user' | 'group' | 'broadcast';
}

interface Message {
  id: number;
  subject: string;
  content: string;
  sent_at: string;
  read_status?: boolean;
  sender_id?: number;
  recipient_id?: number;
  first_name?: string;
  last_name?: string;
  sender_email?: string;
  recipient_email?: string;
  sender_group_name?: string;
  recipient_group_name?: string;
}

export function Messages() {
  const location = useLocation();
  useAuth();
  const navState = location.state as { groupId?: number; groupName?: string } | null;

  const [inbox, setInbox] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [recipientId, setRecipientId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showClearInboxModal, setShowClearInboxModal] = useState(false);
  const [showClearSentModal, setShowClearSentModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const loadData = async () => {
    setLoading(true);
    const groupId = navState?.groupId;
    const [inboxRes, sentRes, contactsRes] = await Promise.all([
      apiClient.getInbox(),
      apiClient.getSent(),
      apiClient.getMessageContacts(groupId),
    ]);
    if (inboxRes.success && Array.isArray(inboxRes.data)) setInbox(inboxRes.data);
    if (sentRes.success && Array.isArray(sentRes.data)) setSent(sentRes.data);
    if (contactsRes.success && Array.isArray(contactsRes.data)) {
      const contactList = contactsRes.data as Contact[];
      setContacts(contactList);
      if (contactList.length > 0 && !recipientId) {
        setRecipientId(String(contactList[0].id));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [navState?.groupId]);

  useEffect(() => {
    if (replyTo) {
      setSubject(replyTo.subject.startsWith('Re: ') ? replyTo.subject : `Re: ${replyTo.subject}`);
      setContent('');
      const fromId = replyTo.sender_id;
      if (fromId && contacts.some((c) => c.id === fromId)) setRecipientId(String(fromId));
    }
  }, [replyTo]);

  const sendMessage = async () => {
    const rid = recipientId ? Number(recipientId) : 0;
    const selectedContact = contacts.find((c) => String(c.id) === recipientId);
    const contactType = selectedContact?.type || 'user';

    const hasRecipient = replyTo || (contactType === 'group' && rid > 0) || (contactType === 'broadcast' && rid === -1) || (contactType === 'user' && rid > 0);
    if (!hasRecipient || !subject.trim() || !content.trim()) {
      setMessage({ type: 'error', text: 'Please select a recipient, enter a subject, and write your message.' });
      return;
    }
    setSending(true);
    setMessage(null);

    const payload: any = { subject: subject.trim(), content: content.trim() };
    if (replyTo) {
      payload.parent_id = replyTo.id;
    } else if (contactType === 'group' && rid > 0) {
      payload.group_id = rid;
    } else if (contactType === 'broadcast' && rid === -1) {
      payload.broadcast = true;
    } else {
      payload.recipient_id = rid;
    }

    const res = await apiClient.sendMessage(payload);
    if (res.success) {
      setMessage({ type: 'success', text: 'Message sent successfully.' });
      setSubject('');
      setContent('');
      setReplyTo(null);
      await loadData();
    } else {
      setMessage({ type: 'error', text: (res as any).message || 'Failed to send message' });
    }
    setSending(false);
  };

  const markAsRead = async (msg: Message) => {
    if (activeTab === 'inbox' && !msg.read_status) {
      await apiClient.markMessageRead(msg.id);
      setInbox((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read_status: true } : m)));
    }
    setExpandedId(expandedId === msg.id ? null : msg.id);
  };

  const messages = activeTab === 'inbox' ? inbox : sent;

  const handleClearInbox = async () => {
    setClearing(true);
    setMessage(null);
    const res = await apiClient.clearInbox();
    if (res.success) {
      setInbox([]);
      setMessage({ type: 'success', text: (res as any).message || 'Inbox cleared.' });
    } else {
      setMessage({ type: 'error', text: (res as any).message || 'Failed to clear inbox' });
    }
    setShowClearInboxModal(false);
    setClearing(false);
  };

  const handleClearSent = async () => {
    setClearing(true);
    setMessage(null);
    const res = await apiClient.clearSent();
    if (res.success) {
      setSent([]);
      setMessage({ type: 'success', text: (res as any).message || 'Sent messages cleared.' });
    } else {
      setMessage({ type: 'error', text: (res as any).message || 'Failed to clear sent messages' });
    }
    setShowClearSentModal(false);
    setClearing(false);
  };

  const getFromTo = (msg: Message) => {
    if (activeTab === 'inbox') {
      const name = [msg.first_name, msg.last_name].filter(Boolean).join(' ').trim();
      const base = name || msg.sender_email || 'Unknown';
      return msg.sender_group_name ? `${base} • ${msg.sender_group_name}` : base;
    }
    const name = [msg.first_name, msg.last_name].filter(Boolean).join(' ').trim();
    const base = name || msg.recipient_email || 'Unknown';
    return msg.recipient_group_name ? `${base} • ${msg.recipient_group_name}` : base;
  };

  return (
    <MainLayout title="Messages">
      <div className="space-y-6">
        {navState?.groupName && (
          <Card className="bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">Messaging from: <strong>{navState.groupName}</strong></p>
          </Card>
        )}

        <Card>
          <h2 className="text-xl font-semibold text-[#022B3A] mb-4 flex items-center gap-2">
            <Send size={22} /> Compose Message
          </h2>
          {message && (
            <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message.text}
            </div>
          )}
          {replyTo && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center justify-between">
              <span>Replying to message — {replyTo.sender_group_name ? `will be sent to entire ${replyTo.sender_group_name}` : 'will be sent to group'}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-blue-600 hover:underline font-medium">Cancel reply</button>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={recipientId}
                onChange={(e) => { setReplyTo(null); setRecipientId(e.target.value); }}
                disabled={!!replyTo}
              >
                <option value="">Select recipient...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.label ? `(${c.label})` : ''}
                  </option>
                ))}
              </select>
              {contacts.length === 0 && !loading && (
                <p className="text-xs text-amber-600 mt-1">No contacts available. Join a group and have a supervisor assigned to message.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={4}
                placeholder="Write your message..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <Button onClick={sendMessage} disabled={sending || !recipientId}>
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === 'inbox' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveTab('inbox'); setExpandedId(null); }}
              >
                <Inbox size={16} className="mr-1" /> Inbox ({inbox.length})
              </Button>
              <Button
                variant={activeTab === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveTab('sent'); setExpandedId(null); }}
              >
                <Mail size={16} className="mr-1" /> Sent ({sent.length})
              </Button>
            </div>
            {activeTab === 'inbox' && inbox.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearInboxModal(true)}
                disabled={clearing}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 size={14} className="mr-1" /> Clear Inbox
              </Button>
            )}
            {activeTab === 'sent' && sent.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearSentModal(true)}
                disabled={clearing}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 size={14} className="mr-1" /> Clear Sent
              </Button>
            )}
          </div>
          <ConfirmationModal
            isOpen={showClearInboxModal}
            onClose={() => setShowClearInboxModal(false)}
            onConfirm={handleClearInbox}
            title="Clear Inbox"
            message="Are you sure you want to permanently delete all messages in your inbox? This cannot be undone."
            confirmText="Clear Inbox"
            type="danger"
          />
          <ConfirmationModal
            isOpen={showClearSentModal}
            onClose={() => setShowClearSentModal(false)}
            onConfirm={handleClearSent}
            title="Clear Sent Messages"
            message="Are you sure you want to permanently delete all sent messages? This cannot be undone."
            confirmText="Clear Sent"
            type="danger"
          />
          {loading ? (
            <div className="text-gray-500 py-8">Loading messages...</div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`border rounded-lg overflow-hidden ${
                    activeTab === 'inbox' && !msg.read_status ? 'border-[#022B3A] bg-blue-50/30' : 'border-gray-200'
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => markAsRead(msg)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{msg.subject}</p>
                      <p className="text-sm text-gray-600">
                        {activeTab === 'inbox' ? 'From' : 'To'}: {getFromTo(msg)} • {msg.sent_at?.split('T')[0]}
                      </p>
                    </div>
                    {expandedId === msg.id ? (
                      <ChevronUp size={20} className="text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />
                    )}
                  </div>
                  {expandedId === msg.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap mb-3">{msg.content}</p>
                      {activeTab === 'inbox' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyTo(msg);
                            setExpandedId(null);
                          }}
                        >
                          <Reply size={14} className="mr-1" /> Reply
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-500">No messages yet.</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
