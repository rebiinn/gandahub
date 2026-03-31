import { useState, useEffect } from 'react';
import { messagesAPI } from '../services/api';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    messagesAPI.getConversations()
      .then((res) => {
        const data = res.data.data;
        setConversations(Array.isArray(data) ? data : []);
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setMessages([]);
      return;
    }
    messagesAPI.getMessages(selected.id)
      .then((res) => setMessages(res.data.data || []))
      .catch(() => setMessages([]));
  }, [selected?.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selected) return;
    try {
      setSending(true);
      await messagesAPI.sendMessage({ conversation_id: selected.id, body: newMessage.trim() });
      setNewMessage('');
      const res = await messagesAPI.getMessages(selected.id);
      setMessages(res.data.data || []);
    } catch (error) {
      console.error('Send failed:', error);
    } finally {
      setSending(false);
    }
  };

  const storeName = selected?.store?.name || 'Store';

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Messages</h1>
      <p className="text-gray-600 mb-4">Chat with stores you&apos;ve purchased from</p>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden flex" style={{ minHeight: 400 }}>
        <div className="w-72 border-r flex flex-col">
          <div className="p-4 border-b font-medium">Conversations</div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No messages yet. Stores will message you after you purchase their products.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left p-4 hover:bg-gray-50 border-b ${selected?.id === c.id ? 'bg-primary-50 border-l-4 border-l-primary-600' : ''}`}
                >
                  <p className="font-medium text-gray-800 truncate">{c.store?.name || 'Store'}</p>
                  {c.messages?.[0] && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">{c.messages[0].body}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="p-4 border-b bg-gray-50">
                <p className="font-medium">{storeName}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        m.sender_type === 'customer'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{m.body}</p>
                      <p className={`text-xs mt-1 ${m.sender_type === 'customer' ? 'text-primary-200' : 'text-gray-500'}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                />
                <Button type="submit" variant="primary" disabled={sending || !newMessage.trim()}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
