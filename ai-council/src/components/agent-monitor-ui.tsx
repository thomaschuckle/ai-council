import React, { useState, useEffect, useRef } from 'react';
import { Send, Radio, Users, Settings, Wifi, WifiOff } from 'lucide-react';

interface Message {
  id: string;
  timestamp: string;
  conversation_id?: string;
  content: string;
  agent_name: string;
  role?: string;
  metadata?: any;
}

interface Config {
  websocketUrl: string;
  conversationId: string;
  orchestratorUrl: string;
}

const AgentMonitor: React.FC = () => {
  // Helper function to generate conversation ID from date
  const generateConversationId = async (date: Date): Promise<string> => {
    const dateStr = date.toISOString().split('T')[0];
    const encoder = new TextEncoder();
    const data = encoder.encode(dateStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16);
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [worldEvent, setWorldEvent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [pendingUserInput, setPendingUserInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const lastProcessedMessageId = useRef<string | null>(null);
  const userInputTimeoutRef = useRef<number | null>(null);
  const isAutoModeRef = useRef(true); // Synchronous ref for immediate checks

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [config, setConfig] = useState<Config>({
    websocketUrl: 'wss://your-api-id.execute-api.us-east-1.amazonaws.com/production',
    conversationId: 'initializing',
    orchestratorUrl: 'http://localhost:8080/api/v2/tasks'
  });

  // Initialize conversation ID
  useEffect(() => {
    const initConversationId = async () => {
      const date = new Date(selectedDate + 'T00:00:00Z');
      const id = await generateConversationId(date);
      setConfig(prev => ({ ...prev, conversationId: id }));
    };
    initConversationId();
  }, [selectedDate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket connection management
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [config.websocketUrl, config.conversationId]);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setWsStatus('connecting');
    console.log('Connecting to WebSocket...', config.websocketUrl);

    try {
      const ws = new WebSocket(config.websocketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsStatus('connected');
        reconnectAttempts.current = 0;

        ws.send(JSON.stringify({
          action: 'subscribe',
          conversation_id: config.conversationId
        }));

        console.log(`Subscribed to conversation: ${config.conversationId}`);
      };

      ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        
        try {
          const message = JSON.parse(event.data);
          console.log('Parsed message:', message);
    
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          
          const updated = [...prev, message];
          const sorted = updated.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          return sorted;
        });
    
          // Process latest message for auto-continuation OUTSIDE the setState
          // This ensures the isAutoModeRef check happens synchronously
          if (message.id !== lastProcessedMessageId.current) {
            lastProcessedMessageId.current = message.id;
            handleNewMessage(message);  // Check happens inside handleNewMessage
          }
          
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };


      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('disconnected');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setWsStatus('disconnected');
        wsRef.current = null;
        attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setWsStatus('disconnected');
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    const maxAttempts = 10;
    const baseDelay = 1000;
    
    if (reconnectAttempts.current >= maxAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), 30000);
    
    console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current})`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = window.setTimeout(() => {
      connectWebSocket();
    }, delay);
  };

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Keep track of all timers
  const userInputTimers = useRef<number[]>([]);

  const handleNewMessage = async (message: Message) => {
    console.log('New message arrived:', message.agent_name, message.content.substring(0, 50));

    if (!isAutoModeRef.current) {
      console.log('Halt mode - ignoring auto-continuation');
      return;
    }

    setPendingUserInput(true);

    // Clear all previous timers
    userInputTimers.current.forEach(id => clearTimeout(id));
    userInputTimers.current = [];

    // Set new timer
    const timerId = window.setTimeout(async () => {
      if (!isAutoModeRef.current) {
        setPendingUserInput(false);
        return;
      }

      setPendingUserInput(false);

      if (isAutoModeRef.current && !worldEvent.trim()) {
        await sendOrchestratorRequest(message);
      }
    }, 3000);

    userInputTimers.current.push(timerId);
  };

  const sendOrchestratorRequest = async (latestMessage?: Message) => {
    if (isLoading) return;
    
    // CRITICAL: Block auto-requests when in halt mode - use ref for immediate check
    if (!isAutoModeRef.current && !worldEvent.trim()) {
      console.log('Halt mode active - blocking auto-request');
      return;
    }
  
    setIsLoading(true);
  
    try {
      let prompt = '';
      
      if (worldEvent.trim()) {
        // User provided input - use that
        prompt = `${worldEvent.trim()}. Make sure to tell the member to always write to the dynamo database. DO NOT EVER LET AGENTS CREATE OR USE ARTIFACTS.`;
        setWorldEvent(''); // Clear input after using
      } else if (latestMessage) {
        // Auto-continue based on latest message
        prompt = `${latestMessage.agent_name} has spoken and they say "${latestMessage.content}". Choose the next appropriate council member to continue the conversation. Goal is to discuss between appropriate agents until crisis or problem is resolved. Make sure to tell the member to always write to the dynamo database. DO NOT EVER LET AGENTS CREATE OR USE ARTIFACTS.`;
      } else {
        return;
      }
    
    console.log('Sending orchestrator request:', prompt);
    
    const formData = new FormData();
    formData.append('agent_name', 'OrchestratorAgent');
    formData.append('prompt', prompt);
    
    const response = await fetch(config.orchestratorUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('Orchestrator request successful');
    
    } catch (error) {
      console.error('Failed to send orchestrator request:', error);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleSendEvent = async () => {
    if (!worldEvent.trim()) return;
    
    // Clear the user input timeout since user is manually sending
    if (userInputTimeoutRef.current) {
      clearTimeout(userInputTimeoutRef.current);
    }
    setPendingUserInput(false);
    
    await sendOrchestratorRequest();
  };

  const handleToggleAutoMode = () => {
    const newAutoMode = !isAutoMode;
    
    // Update BOTH state and ref synchronously
    setIsAutoMode(newAutoMode);
    isAutoModeRef.current = newAutoMode;
    
    // Clear all pending auto-continuation timers
    userInputTimers.current.forEach(id => clearTimeout(id));
    userInputTimers.current = [];
    setPendingUserInput(false);

    setPendingUserInput(false);
    
    console.log(`Mode switched to: ${newAutoMode ? 'AUTO' : 'HALT'}`);
    
    // If turning AUTO back ON, pick up latest message and process it
    if (newAutoMode && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      handleNewMessage(latestMessage);  // This starts the 3-second timer
    }
  };

  const handleDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr);
    const date = new Date(dateStr + 'T00:00:00Z');
    const newConversationId = await generateConversationId(date);
    setConfig(prev => ({ ...prev, conversationId: newConversationId }));
  };

  const getMessageColor = (agent_name: string, role?: string): string => {
    if (agent_name === 'system' || role === 'system') return 'bg-red-50 border-red-300';
    if (role === 'user') return 'bg-purple-50 border-purple-300';
    return 'bg-blue-50 border-blue-300';
  };

  const getAgentIcon = (agent_name: string): JSX.Element => {
    if (agent_name === 'system') return <Radio className="w-5 h-5 text-red-500" />;
    return <Radio className="w-5 h-5 text-blue-500" />;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      let normalizedTimestamp = timestamp;
      
      // Handle Python microseconds - convert to milliseconds
      const microsecondMatch = timestamp.match(/\.(\d{6})/);
      if (microsecondMatch) {
        normalizedTimestamp = timestamp.replace(/\.(\d{6})/, '.' + microsecondMatch[1].substring(0, 3));
      }
      
      const date = new Date(normalizedTimestamp);
      
      if (isNaN(date.getTime())) {
        console.error('Invalid timestamp:', timestamp);
        return 'Invalid Date';
      }
      
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">The AI Council</h1>
                <p className="text-xs sm:text-sm text-gray-500">Real-time agent communication</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                {wsStatus === 'connected' ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : wsStatus === 'connecting' ? (
                  <Wifi className="w-5 h-5 text-yellow-500 animate-pulse" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="text-xs sm:text-sm font-medium text-gray-600 hidden sm:inline">
                  {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={config.websocketUrl}
                    onChange={(e) => setConfig({...config, websocketUrl: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orchestrator API URL
                  </label>
                  <input
                    type="text"
                    value={config.orchestratorUrl}
                    onChange={(e) => setConfig({...config, orchestratorUrl: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conversation Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Generated Conversation ID
                  </label>
                  <input
                    type="text"
                    value={config.conversationId}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono text-gray-600"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={disconnectWebSocket}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                >
                  Disconnect
                </button>
                <button
                  onClick={connectWebSocket}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                >
                  Reconnect
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Messages Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 sm:p-4 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  Council Discussions ({messages.length})
                </h2>
                <button
                  onClick={() => setMessages([])}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-white text-xs sm:text-sm transition-colors"
                >
                  Clear
                </button>
              </div>
              
              <div className="overflow-y-auto p-3 sm:p-4 space-y-3 max-h-[600px]">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Radio className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-50" />
                    <p className="text-base sm:text-lg font-medium">The Council awaits...</p>
                    <p className="text-xs sm:text-sm">
                      {wsStatus === 'connected' ? 'Listening for messages...' : 'Connect to WebSocket to begin'}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`border-l-4 rounded-lg p-3 sm:p-4 ${getMessageColor(msg.agent_name, msg.role)} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="mt-1 flex-shrink-0">
                          {getAgentIcon(msg.agent_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <span className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                              {msg.agent_name}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          <p className="text-gray-700 leading-relaxed text-sm sm:text-base break-words whitespace-pre-wrap">
                            {msg.content}
                          </p>
                          {msg.metadata && (
                            <div className="mt-2 text-xs text-gray-500">
                              Role: {msg.role || 'assistant'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4 sm:space-y-6">
            {/* Divine Intervention */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-3 sm:p-4">
                <h2 className="text-base sm:text-lg font-semibold text-white">⚡ Divine Intervention</h2>
              </div>
              <div className="p-3 sm:p-4">
                {pendingUserInput && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    ⏳ Waiting for input... Auto-continuing in 3s
                  </div>
                )}
                <textarea
                  value={worldEvent}
                  onChange={(e) => {
                    setWorldEvent(e.target.value);
                    // Cancel auto-continue if user starts typing
                    if (e.target.value.trim() && userInputTimeoutRef.current) {
                      clearTimeout(userInputTimeoutRef.current);
                      setPendingUserInput(false);
                    }
                  }}
                  placeholder="Type to override auto-conversation, or leave blank for autonomous discussion..."
                  className="w-full h-24 sm:h-32 p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm"
                  disabled={isLoading || wsStatus !== 'connected'}
                />
                <div className="flex gap-2 mt-2 sm:mt-3">
                  <button
                    onClick={handleSendEvent}
                    disabled={!worldEvent.trim() || isLoading || wsStatus !== 'connected'}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 sm:py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    {isLoading ? 'Sending...' : 'Send Event'}
                  </button>
                  <button
                    onClick={handleToggleAutoMode}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      isAutoMode 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                    }`}
                  >
                    {isAutoMode ? '▶️ Auto' : '⏸️ Halt'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {isAutoMode 
                    ? 'Auto mode: Council continues autonomously' 
                    : 'Halted: Waiting for manual input'}
                </p>
              </div>
            </div>

            {/* Connection Info */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-3 sm:p-4">
                <h2 className="text-base sm:text-lg font-semibold text-white">📡 Connection Info</h2>
              </div>
              <div className="p-3 sm:p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-semibold ${
                    wsStatus === 'connected' ? 'text-green-600' : 
                    wsStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {wsStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mode:</span>
                  <span className={`font-semibold ${isAutoMode ? 'text-green-600' : 'text-orange-600'}`}>
                    {isAutoMode ? 'AUTONOMOUS' : 'MANUAL'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Conversation:</span>
                  <span className="font-mono text-xs text-gray-800">{config.conversationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-semibold text-gray-800">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Messages:</span>
                  <span className="font-semibold text-blue-600">{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing:</span>
                  <span className={`font-semibold ${isLoading ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {isLoading ? 'ACTIVE' : 'IDLE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentMonitor;