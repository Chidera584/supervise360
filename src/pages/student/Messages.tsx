import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';

export function Messages() {
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const loadMessages = async () => {
    const [inboxRes, sentRes] = await Promise.all([
      apiClient.getInbox(),
      apiClient.getSent()
    ]);
    if (inboxRes.success) setInbox(inboxRes.data || []);
    if (sentRes.success) setSent(sentRes.data || []);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const sendMessage = async () => {
    if (!recipientId || !subject || !content) return;
    await apiClient.sendMessage({
      recipient_id: Number(recipientId),
      subject,
      content
    });
    setSubject('');
    setContent('');
    await loadMessages();
  };

  const messages = activeTab === 'inbox' ? inbox : sent;

  return (
    <MainLayout title="Messages">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e] mb-4">Compose Message</h2>
          <div className="space-y-3">
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Recipient User ID"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            />
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={4}
              placeholder="Message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button onClick={sendMessage}>Send</Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4 mb-4">
            <Button variant={activeTab === 'inbox' ? 'default' : 'outline'} onClick={() => setActiveTab('inbox')}>
              Inbox
            </Button>
            <Button variant={activeTab === 'sent' ? 'default' : 'outline'} onClick={() => setActiveTab('sent')}>
              Sent
            </Button>
          </div>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900">{message.subject}</p>
                <p className="text-sm text-gray-600">{message.content}</p>
                <p className="text-xs text-gray-500 mt-1">{message.sent_at?.split('T')[0]}</p>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-gray-500">No messages.</div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
