import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { Trash2, Reply, Plus, MessageCircle } from 'lucide-react';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';

const TEAL = '#006D6D';

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
  message_type?: string;
}

export function Messages() {
  const location = useLocation();
  const { user } = useAuth();
  const navState = location.state as { groupId?: number; groupName?: string } | null;
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'external_supervisor';

  const [inbox, setInbox] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [recipientId, setRecipientId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'groups' | 'broadcast' | 'group' | 'direct'>('all');
  const [composeMode, setComposeMode] = useState<'broadcast' | 'group' | 'direct'>('group');
  const [directStudentOptions, setDirectStudentOptions] = useState<{ user_id: number; name: string; matric: string }[]>([]);
  const [headerSearch, setHeaderSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showClearInboxModal, setShowClearInboxModal] = useState(false);
  const [showClearSentModal, setShowClearSentModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const loadData = async () => {
    setLoading(true);
    const groupId = navState?.groupId;
    const [inboxRes, sentRes, contactsRes, groupsRes, studentsRes] = await Promise.all([
      apiClient.getInbox(),
      apiClient.getSent(),
      apiClient.getMessageContacts(groupId),
      isSupervisor ? apiClient.getSupervisorMyGroups() : Promise.resolve({ success: false, data: [] }),
      isSupervisor ? apiClient.getStudents() : Promise.resolve({ success: false, data: [] }),
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
    if (
      isSupervisor &&
      groupsRes.success &&
      Array.isArray(groupsRes.data) &&
      studentsRes.success &&
      Array.isArray(studentsRes.data)
    ) {
      const matrics = new Set<string>();
      (groupsRes.data as any[]).forEach((g) => {
        (g.members || []).forEach((m: any) => {
          const t = String(m.matricNumber || m.matric_number || '').trim();
          if (t) matrics.add(t);
        });
      });
      const opts = (studentsRes.data as any[])
        .filter((s) => matrics.has(String(s.matric_number || '').trim()))
        .map((s) => ({
          user_id: Number(s.user_id),
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
          matric: String(s.matric_number || ''),
        }))
        .filter((o) => o.user_id > 0);
      setDirectStudentOptions(opts);
    } else {
      setDirectStudentOptions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [navState?.groupId, isSupervisor]);

  useEffect(() => {
    if (!isSupervisor || replyTo) return;
    const broadcast = contacts.find((c) => c.type === 'broadcast');
    const firstGroup = contacts.find((c) => c.type === 'group');
    if (composeMode === 'broadcast' && broadcast) setRecipientId(String(broadcast.id));
    else if (composeMode === 'group' && firstGroup) setRecipientId(String(firstGroup.id));
    else if (composeMode === 'direct' && directStudentOptions.length > 0) {
      setRecipientId(String(directStudentOptions[0].user_id));
    }
  }, [isSupervisor, composeMode, contacts, directStudentOptions, replyTo]);

  useEffect(() => {
    if (replyTo) {
      setSubject(replyTo.subject.startsWith('Re: ') ? replyTo.subject : `Re: ${replyTo.subject}`);
      setContent('');
      const fromId = replyTo.sender_id;
      if (fromId && contacts.some((c) => c.id === fromId)) setRecipientId(String(fromId));
    }
  }, [replyTo]);

  const messages = activeTab === 'inbox' ? inbox : sent;

  const filteredList = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    let list = messages;
    if (activeTab === 'inbox' && listFilter === 'unread') {
      list = list.filter((m) => !m.read_status);
    }
    if (activeTab === 'inbox' && listFilter === 'groups') {
      list = list.filter((m) => !!m.sender_group_name);
    }
    if (activeTab === 'inbox' && listFilter === 'broadcast') {
      list = list.filter((m) => m.message_type === 'broadcast');
    }
    if (activeTab === 'inbox' && listFilter === 'group') {
      list = list.filter((m) => m.message_type === 'group' || (!!m.sender_group_name && m.message_type !== 'broadcast'));
    }
    if (activeTab === 'inbox' && listFilter === 'direct') {
      list = list.filter(
        (m) =>
          m.message_type === 'direct' ||
          m.message_type === 'student' ||
          (!m.message_type && !m.sender_group_name)
      );
    }
    if (!q) return list;
    return list.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        getFromTo(m).toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q)
    );
  }, [messages, headerSearch, listFilter, activeTab]);

  useEffect(() => {
    if (filteredList.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredList.some((m) => m.id === selectedId)) {
      setSelectedId(filteredList[0].id);
    }
  }, [filteredList, selectedId]);

  const selected = filteredList.find((m) => m.id === selectedId) ?? null;

  const sendMessage = async () => {
    const rid = recipientId ? Number(recipientId) : 0;
    const selectedContact = contacts.find((c) => String(c.id) === recipientId);
    const contactType = selectedContact?.type || 'user';

    const hasRecipient = isSupervisor
      ? replyTo ||
        (composeMode === 'broadcast' && rid === -1) ||
        (composeMode === 'group' && rid > 0) ||
        (composeMode === 'direct' && rid > 0)
      : replyTo ||
        (contactType === 'group' && rid > 0) ||
        (contactType === 'broadcast' && rid === -1) ||
        (contactType === 'user' && rid > 0);
    if (!hasRecipient || !subject.trim() || !content.trim()) {
      setMessage({ type: 'error', text: 'Please select a recipient, enter a subject, and write your message.' });
      return;
    }
    setSending(true);
    setMessage(null);

    const payload: any = { subject: subject.trim(), content: content.trim() };
    if (replyTo) {
      payload.parent_id = replyTo.id;
    } else if (isSupervisor) {
      if (composeMode === 'broadcast') {
        payload.broadcast = true;
      } else if (composeMode === 'group') {
        payload.group_id = rid;
      } else {
        payload.recipient_id = rid;
        payload.message_type = 'direct';
      }
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
    setSelectedId(msg.id);
  };

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
    <MainLayout
      title="Messages"
      topBarSearch={{
        placeholder: 'Search conversations…',
        value: headerSearch,
        onChange: setHeaderSearch,
      }}
    >
      <div className="min-w-0 space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Messaging</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Centralized conversations with your supervisor and group.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(260px,340px)_1fr] gap-6 items-stretch min-h-[min(70vh,640px)]">
          {/* Conversation list */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex rounded-[10px] border border-slate-200 p-1 bg-[#F8F9FA]">
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'inbox' ? 'text-white shadow-sm' : 'text-slate-600'
                  }`}
                  style={activeTab === 'inbox' ? { backgroundColor: TEAL } : undefined}
                >
                  Inbox ({inbox.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sent')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'sent' ? 'text-white shadow-sm' : 'text-slate-600'
                  }`}
                  style={activeTab === 'sent' ? { backgroundColor: TEAL } : undefined}
                >
                  Sent ({sent.length})
                </button>
              </div>
              {activeTab === 'inbox' && (
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['all', 'All'],
                      ['unread', 'Unread'],
                      ['broadcast', 'Broadcast'],
                      ['group', 'Group'],
                      ['direct', 'Direct'],
                      ['groups', 'Has group tag'],
                    ] as const
                  ).map(([f, label]) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setListFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        listFilter === f
                          ? 'text-white border-transparent'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                      style={listFilter === f ? { backgroundColor: TEAL } : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px]">
              {loading ? (
                <p className="p-6 text-sm text-slate-500 text-center">Loading…</p>
              ) : filteredList.length === 0 ? (
                <p className="p-8 text-sm text-slate-500 text-center">No messages match.</p>
              ) : (
                filteredList.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => markAsRead(msg)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      selectedId === msg.id ? 'bg-[#006D6D]/08' : ''
                    } ${activeTab === 'inbox' && !msg.read_status ? 'border-l-[3px] border-l-[#006D6D]' : ''}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm truncate">{msg.subject}</p>
                      {msg.message_type && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {msg.message_type === 'broadcast'
                            ? 'Broadcast'
                            : msg.message_type === 'group'
                              ? 'Group'
                              : 'Direct'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{getFromTo(msg)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{msg.sent_at?.split('T')[0]}</p>
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t border-slate-100 flex flex-wrap gap-2">
              {activeTab === 'inbox' && inbox.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowClearInboxModal(true)}
                  disabled={clearing}
                  className="!text-red-600 !border-red-200 hover:!bg-red-50"
                >
                  <Trash2 size={14} className="mr-1" /> Clear inbox
                </Button>
              )}
              {activeTab === 'sent' && sent.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowClearSentModal(true)}
                  disabled={clearing}
                  className="!text-red-600 !border-red-200 hover:!bg-red-50"
                >
                  <Trash2 size={14} className="mr-1" /> Clear sent
                </Button>
              )}
            </div>
          </div>

          {/* Detail + compose */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col min-h-[480px]">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: TEAL }} />
                Compose message
              </h2>
              {message && (
                <div
                  className={`mt-3 p-3 rounded-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {message.text}
                </div>
              )}
              {replyTo && (
                <div className="mt-3 p-3 rounded-lg bg-sky-50 border border-sky-100 text-sm text-sky-900 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    Replying to message —{' '}
                    {replyTo.sender_group_name
                      ? `will be sent to entire ${replyTo.sender_group_name}`
                      : 'will be sent to group'}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-sky-700 font-medium shrink-0">
                    Cancel
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {isSupervisor && !replyTo && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">Send as</label>
                    <div className="flex flex-wrap gap-2">
                      {contacts.some((c) => c.type === 'broadcast') && (
                        <button
                          type="button"
                          onClick={() => setComposeMode('broadcast')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            composeMode === 'broadcast' ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'
                          }`}
                          style={composeMode === 'broadcast' ? { backgroundColor: TEAL } : undefined}
                        >
                          Broadcast (all students)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setComposeMode('group')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          composeMode === 'group' ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                        style={composeMode === 'group' ? { backgroundColor: TEAL } : undefined}
                      >
                        Group thread
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeMode('direct')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          composeMode === 'direct' ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                        style={composeMode === 'direct' ? { backgroundColor: TEAL } : undefined}
                      >
                        Direct (one student)
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
                  {isSupervisor && !replyTo && composeMode === 'broadcast' && (
                    <select
                      className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm bg-[#F8F9FA]"
                      value={String(contacts.find((c) => c.type === 'broadcast')?.id ?? -1)}
                      disabled
                    >
                      <option value={-1}>All supervised students</option>
                    </select>
                  )}
                  {isSupervisor && !replyTo && composeMode === 'group' && (
                    <select
                      className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm bg-[#F8F9FA]"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                    >
                      <option value="">Select group…</option>
                      {contacts
                        .filter((c) => c.type === 'group')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (group)
                          </option>
                        ))}
                    </select>
                  )}
                  {isSupervisor && !replyTo && composeMode === 'direct' && (
                    <select
                      className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm bg-[#F8F9FA]"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                    >
                      <option value="">Select student…</option>
                      {directStudentOptions.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.name} ({s.matric})
                        </option>
                      ))}
                    </select>
                  )}
                  {!isSupervisor && (
                    <select
                      className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm bg-[#F8F9FA]"
                      value={recipientId}
                      onChange={(e) => {
                        setReplyTo(null);
                        setRecipientId(e.target.value);
                      }}
                      disabled={!!replyTo}
                    >
                      <option value="">Select recipient…</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.label ? `(${c.label})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {isSupervisor && replyTo && (
                    <select
                      className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm bg-[#F8F9FA]"
                      value={recipientId}
                      disabled
                    >
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.label ? `(${c.label})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {isSupervisor && composeMode === 'direct' && directStudentOptions.length === 0 && !loading && (
                    <p className="text-xs text-amber-700 mt-1">No students found in your supervised groups.</p>
                  )}
                  {!isSupervisor && contacts.length === 0 && !loading && (
                    <p className="text-xs text-amber-700 mt-1">No contacts yet—join a group with a supervisor.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Subject</label>
                  <input
                    className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm"
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Message</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm min-h-[100px] resize-y"
                    placeholder="Type a message…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
                <Button
                  onClick={sendMessage}
                  disabled={sending || !recipientId}
                  className="!rounded-[10px] !bg-[#006D6D] hover:!bg-[#005a5a] !text-white border-0"
                >
                  {sending ? 'Sending…' : 'Send message'}
                </Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 border-t border-slate-100">
              <div className="px-4 py-2 border-b border-slate-50 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <MessageCircle className="w-4 h-4" style={{ color: TEAL }} />
                Thread
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F8F9FA]/80">
                {!selected ? (
                  <p className="text-center text-slate-500 text-sm py-12">Select a message to read.</p>
                ) : (
                  <div className="max-w-xl">
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-sm border ${
                        activeTab === 'sent'
                          ? 'ml-auto text-white border-transparent'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                      style={activeTab === 'sent' ? { backgroundColor: TEAL } : undefined}
                    >
                      <p className="text-xs opacity-80 mb-1">{getFromTo(selected)}</p>
                      <p className="font-semibold">{selected.subject}</p>
                      <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed opacity-95">{selected.content}</p>
                      <p className="text-[10px] mt-3 opacity-70">{selected.sent_at?.replace('T', ' ').slice(0, 16)}</p>
                    </div>
                    {activeTab === 'inbox' && (
                      <Button
                        variant="outline"
                        className="mt-4 !rounded-[10px]"
                        onClick={() => {
                          setReplyTo(selected);
                          setSelectedId(selected.id);
                        }}
                      >
                        <Reply size={14} className="mr-1" /> Reply
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ConfirmationModal
          isOpen={showClearInboxModal}
          onClose={() => setShowClearInboxModal(false)}
          onConfirm={handleClearInbox}
          title="Clear inbox"
          message="Are you sure you want to permanently delete all messages in your inbox? This cannot be undone."
          confirmText="Clear inbox"
          type="danger"
        />
        <ConfirmationModal
          isOpen={showClearSentModal}
          onClose={() => setShowClearSentModal(false)}
          onConfirm={handleClearSent}
          title="Clear sent messages"
          message="Are you sure you want to permanently delete all sent messages? This cannot be undone."
          confirmText="Clear sent"
          type="danger"
        />
      </div>
    </MainLayout>
  );
}
