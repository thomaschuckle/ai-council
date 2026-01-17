import React, { useState, useEffect, useRef } from 'react';
import { Send, Radio, Users, AlertCircle, Settings, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  timestamp: string;
  type: string;
  from: string;
  to: string;
  content: string;
  topic: string;
  status?: string;
}

interface Config {
  restGatewayUrl: string;
  presidentEndpoint: string;
  treasuryEndpoint: string;
  eventsEndpoint: string;
  messagesEndpoint: string;
  userId: string;
  sessionId: string;
}

const AgentMonitor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [worldEvent, setWorldEvent] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<Config>({
    restGatewayUrl: 'http://localhost:8080',
    presidentEndpoint: '/api/chat/president',
    treasuryEndpoint: '/api/chat/treasury',
    eventsEndpoint: '/api/events/world',
    messagesEndpoint: '/api/messages/stream',
    userId: 'system',
    sessionId: 'monitor-session'
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchMessages();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [config]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${config.restGatewayUrl}${config.messagesEndpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': config.userId,
          'X-Session-ID': config.sessionId
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const newMessages = data.messages.filter(
              (msg: Message) => !prev.find(m => m.id === msg.id)
            );
            return [...prev, ...newMessages];
          });
        }
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setIsConnected(false);
    }
  };

  const handleSendEvent = async () => {
    if (!worldEvent.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${config.restGatewayUrl}${config.eventsEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': config.userId,
          'X-Session-ID': config.sessionId
        },
        body: JSON.stringify({
          event_type: 'world_event',
          content: worldEvent,
          timestamp: new Date().toISOString(),
          broadcast_to: ['PresidentAgent', 'TreasuryAgent']
        })
      });

      if (response.ok) {
        const newEvent: Message = {
          id: `event-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'world_event',
          from: 'System',
          to: 'All Agents',
          content: worldEvent,
          topic: 'government/events/world',
          status: 'sent'
        };
        
        setMessages(prev => [...prev, newEvent]);
        setWorldEvent('');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send event:', error);
      alert(`Failed to send event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendToAgent = async (agentName: string, message: string) => {
    setIsLoading(true);

    try {
      const endpoint = agentName === 'PresidentAgent' 
        ? config.presidentEndpoint 
        : config.treasuryEndpoint;

      const response = await fetch(`${config.restGatewayUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': config.userId,
          'X-Session-ID': config.sessionId
        },
        body: JSON.stringify({
          message: message,
          user_id: config.userId,
          session_id: config.sessionId,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'user_message',
          from: 'User',
          to: agentName,
          content: message,
          topic: `direct/${agentName.toLowerCase()}`,
          status: 'sent'
        }]);

        if (result.response) {
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: `resp-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              type: 'agent_response',
              from: agentName,
              to: 'User',
              content: result.response,
              topic: `response/${agentName.toLowerCase()}`,
              status: 'received'
            }]);
          }, 500);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(`Failed to send to ${agentName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    if (confirm('Clear all messages?')) {
      setMessages([]);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${config.restGatewayUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        alert('✅ Connection successful!');
        setIsConnected(true);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      alert(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageColor = (type: string, from: string): string => {
    if (type === 'world_event') return 'bg-red-50 border-red-300';
    if (type === 'user_message') return 'bg-purple-50 border-purple-300';
    if (from === 'PresidentAgent') return 'bg-blue-50 border-blue-300';
    if (from === 'TreasuryAgent') return 'bg-green-50 border-green-300';
    return 'bg-gray-50 border-gray-300';
  };

  const getAgentIcon = (from: string): JSX.Element => {
    if (from === 'System') return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <Radio className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Agent Communication Monitor</h1>
                <p className="text-sm text-gray-500">REST Gateway Interface</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-sm font-medium text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <ConfigField 
                  label="REST Gateway URL" 
                  value={config.restGatewayUrl}
                  onChange={(val) => setConfig({...config, restGatewayUrl: val})}
                />
                <ConfigField 
                  label="User ID" 
                  value={config.userId}
                  onChange={(val) => setConfig({...config, userId: val})}
                />
                <ConfigField 
                  label="President Endpoint" 
                  value={config.presidentEndpoint}
                  onChange={(val) => setConfig({...config, presidentEndpoint: val})}
                />
                <ConfigField 
                  label="Treasury Endpoint" 
                  value={config.treasuryEndpoint}
                  onChange={(val) => setConfig({...config, treasuryEndpoint: val})}
                />
                <ConfigField 
                  label="Events Endpoint" 
                  value={config.eventsEndpoint}
                  onChange={(val) => setConfig({...config, eventsEndpoint: val})}
                />
                <ConfigField 
                  label="Messages Endpoint" 
                  value={config.messagesEndpoint}
                  onChange={(val) => setConfig({...config, messagesEndpoint: val})}
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={testConnection}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                >
                  Test Connection
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Message Stream</h2>
                <div className="flex gap-2">
                  <button
                    onClick={fetchMessages}
                    disabled={isLoading}
                    className="p-2 hover:bg-blue-500 rounded transition-colors"
                    title="Refresh messages"
                  >
                    <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={clearMessages}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-white text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="h-[600px] overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Radio className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No messages yet</p>
                    <p className="text-sm">Send a world event or message to start</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`border-l-4 rounded-lg p-4 ${getMessageColor(msg.type, msg.from)} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getAgentIcon(msg.from)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">{msg.from}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-600">{msg.to}</span>
                            </div>
                            <span className="text-xs text-gray-500">{msg.timestamp}</span>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{msg.content}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                              {msg.topic}
                            </span>
                            {msg.status && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                msg.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {msg.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-4">
                <h2 className="text-lg font-semibold text-white">World Event Injector</h2>
              </div>
              <div className="p-4">
                <textarea
                  value={worldEvent}
                  onChange={(e) => setWorldEvent(e.target.value)}
                  placeholder="Enter a world event (e.g., 'Major cyber attack on financial systems')"
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleSendEvent();
                    }
                  }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendEvent}
                  disabled={!worldEvent.trim() || isLoading}
                  className="w-full mt-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {isLoading ? 'Sending...' : 'Broadcast Event'}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  POST to: {config.eventsEndpoint}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4">
                <h2 className="text-lg font-semibold text-white">Direct Messages</h2>
              </div>
              <div className="p-4 space-y-3">
                <button
                  onClick={() => {
                    const msg = prompt('Message to President:');
                    if (msg) sendToAgent('PresidentAgent', msg);
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-200 border-2 border-blue-300 rounded-lg font-medium text-blue-700 transition-colors text-left"
                >
                  📨 Message President
                  <p className="text-xs text-blue-600 mt-1">{config.presidentEndpoint}</p>
                </button>
                <button
                  onClick={() => {
                    const msg = prompt('Message to Treasury:');
                    if (msg) sendToAgent('TreasuryAgent', msg);
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-green-100 hover:bg-green-200 disabled:bg-gray-200 border-2 border-green-300 rounded-lg font-medium text-green-700 transition-colors text-left"
                >
                  📨 Message Treasury
                  <p className="text-xs text-green-600 mt-1">{config.treasuryEndpoint}</p>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4">
                <h2 className="text-lg font-semibold text-white">Quick Events</h2>
              </div>
              <div className="p-4 space-y-2">
                <QuickEventButton 
                  onClick={() => setWorldEvent('Stock market crashed by 30%')}
                  label="📉 Market Crash"
                  disabled={isLoading}
                />
                <QuickEventButton 
                  onClick={() => setWorldEvent('Natural disaster requires $500M emergency funding')}
                  label="🌪️ Natural Disaster"
                  disabled={isLoading}
                />
                <QuickEventButton 
                  onClick={() => setWorldEvent('Foreign nation declares trade sanctions')}
                  label="🌍 Trade War"
                  disabled={isLoading}
                />
                <QuickEventButton 
                  onClick={() => setWorldEvent('Major cyber attack on government systems detected')}
                  label="💻 Cyber Attack"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-4">
                <h2 className="text-lg font-semibold text-white">Connection Info</h2>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gateway:</span>
                  <span className="font-mono text-gray-800 text-xs">{config.restGatewayUrl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">User ID:</span>
                  <span className="font-mono text-gray-800">{config.userId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Session:</span>
                  <span className="font-mono text-gray-800 text-xs">{config.sessionId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ConfigFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ConfigField: React.FC<ConfigFieldProps> = ({ label, value, onChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
      />
    </div>
  );
};

interface QuickEventButtonProps {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}

const QuickEventButton: React.FC<QuickEventButtonProps> = ({ onClick, label, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 disabled:bg-gray-100 border border-orange-200 rounded-lg text-sm font-medium text-orange-700 transition-colors"
    >
      {label}
    </button>
  );
};

export default AgentMonitor;