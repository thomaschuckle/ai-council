import React, { useState, useEffect, useRef } from 'react';
import { Send, Radio, Users, Settings, Plus, Trash2 } from 'lucide-react';

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
  postEventUrl: string;
  pollMessagesUrl: string;
  addAgentCommand: string;
  pollInterval: number;
}

interface AgentInfo {
  name: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startTime?: string;
  uptime?: number;
}

const AgentMonitor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [worldEvent, setWorldEvent] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const [config, setConfig] = useState<Config>({
    postEventUrl: 'http://localhost:8000/api/v1/events',
    pollMessagesUrl: 'http://localhost:8000/api/v1/messages',
    addAgentCommand: 'echo "Creating new agent..."',
    pollInterval: 2000
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Start polling for messages
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      pollMessages();
    }, config.pollInterval);

    // Initial poll
    pollMessages();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [config.pollMessagesUrl, config.pollInterval]);

  useEffect(() => {
    // Count YAML files in /configs/agents/
    countAgentFiles();
  }, []);

  const pollMessages = async () => {
    try {
      const response = await fetch(config.pollMessagesUrl);
      if (response.ok) {
        const data = await response.json();
        // Expecting an array of messages
        if (Array.isArray(data)) {
          setMessages(data);
          setIsConnected(true);
        } else if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
          setIsConnected(true);
        }
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Failed to poll messages:', error);
      setIsConnected(false);
    }
  };

  const countAgentFiles = async () => {
    try {
      // This would need a backend endpoint to list .yaml files
      // For now, we'll use a placeholder
      const response = await fetch('http://localhost:8000/api/v1/agents/count');
      if (response.ok) {
        const data = await response.json();
        setAgentCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to count agent files:', error);
      setAgentCount(0);
    }
  };

  const handleSendEvent = async () => {
    if (!worldEvent.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch(config.postEventUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event: worldEvent,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setWorldEvent('');
        // Immediately poll for new messages
        await pollMessages();
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

  const handleAddAgent = () => {
    // Display the command that should be run in the terminal
    const command = config.addAgentCommand;
    
    // Create a temporary textarea to copy the command
    const textarea = document.createElement('textarea');
    textarea.value = command;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      alert(`✅ Command copied to clipboard!\n\nRun this in your terminal:\n\n${command}\n\n(The command has been copied - just paste it in your terminal)`);
    } catch (err) {
      alert(`⚠️ Please run this command in your terminal:\n\n${command}\n\n(Tip: Select and copy the command above)`);
    }
    
    document.body.removeChild(textarea);
    
    // Refresh agent count after a delay (assuming user will run the command)
    setTimeout(() => {
      countAgentFiles();
    }, 2000);
  };

  const stopAgent = async (agentName: string) => {
    alert(`⚠️ Stopping agents requires backend API implementation.`);
  };

  const getMessageColor = (type: string, from: string): string => {
    if (type === 'world_event') return 'bg-red-50 border-red-300';
    if (type === 'user_message') return 'bg-purple-50 border-purple-300';
    if (from.includes('Agent')) return 'bg-blue-50 border-blue-300';
    return 'bg-gray-50 border-gray-300';
  };

  const getAgentIcon = (from: string): JSX.Element => {
    if (from === 'God (System)' || from === 'system') return <Radio className="w-5 h-5 text-red-500" />;
    return <Radio className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">The AI Council</h1>
                <p className="text-xs sm:text-sm text-gray-500">Simulating the fate of humanity</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-xs sm:text-sm font-medium text-gray-600 hidden sm:inline">
                  {isConnected ? 'Connected' : 'Disconnected'}
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
                <ConfigField 
                  label="POST Event URL" 
                  value={config.postEventUrl}
                  onChange={(val) => setConfig({...config, postEventUrl: val})}
                />
                <ConfigField 
                  label="Poll Messages URL" 
                  value={config.pollMessagesUrl}
                  onChange={(val) => setConfig({...config, pollMessagesUrl: val})}
                />
                <ConfigField 
                  label="Add Agent Command" 
                  value={config.addAgentCommand}
                  onChange={(val) => setConfig({...config, addAgentCommand: val})}
                />
                <ConfigField 
                  label="Poll Interval (ms)" 
                  value={config.pollInterval.toString()}
                  onChange={(val) => setConfig({...config, pollInterval: parseInt(val) || 2000})}
                  type="number"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 min-h-0">
          {/* Messages Panel */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-white">Council Discussions</h2>
                <button
                  onClick={() => setMessages([])}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-white text-xs sm:text-sm transition-colors"
                >
                  Clear
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Radio className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-50" />
                    <p className="text-base sm:text-lg font-medium">The Council awaits...</p>
                    <p className="text-xs sm:text-sm">Inject a world event to begin</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`border-l-4 rounded-lg p-3 sm:p-4 ${getMessageColor(msg.type, msg.from)} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="mt-1 flex-shrink-0">
                          {getAgentIcon(msg.from)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-gray-800 text-sm sm:text-base truncate">{msg.from}</span>
                              <span className="text-gray-400 flex-shrink-0">→</span>
                              <span className="text-gray-600 text-sm sm:text-base truncate">{msg.to}</span>
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">{msg.timestamp}</span>
                          </div>
                          <p className="text-gray-700 leading-relaxed text-sm sm:text-base break-words">{msg.content}</p>
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
          <div className="space-y-4 sm:space-y-6 flex flex-col min-h-0">
            {/* Divine Intervention */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden flex-shrink-0">
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-3 sm:p-4">
                <h2 className="text-base sm:text-lg font-semibold text-white">⚡ Divine Intervention</h2>
              </div>
              <div className="p-3 sm:p-4">
                <textarea
                  value={worldEvent}
                  onChange={(e) => setWorldEvent(e.target.value)}
                  placeholder="As the omniscient observer, declare a world event..."
                  className="w-full h-24 sm:h-32 p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendEvent}
                  disabled={!worldEvent.trim() || isLoading}
                  className="w-full mt-2 sm:mt-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 sm:py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  Broadcast to Council
                </button>
              </div>
            </div>

            {/* Council Members */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-white">🤖 Council Members</h2>
                <button
                  onClick={handleAddAgent}
                  className="p-1 hover:bg-green-500 rounded transition-colors"
                  title="Add new agent"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="p-3 sm:p-4 flex-1 overflow-y-auto min-h-0">
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Active Agents:</span>
                    <span className="text-lg font-bold text-green-700">{agentCount}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Based on .yaml files in /configs/agents/</p>
                </div>
                
                <div className="space-y-2">
                  {agents.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-500 text-center py-4">No agents detected</p>
                  ) : (
                    agents.map((agent) => (
                      <div key={agent.name} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded border">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            agent.status === 'running' ? 'bg-green-500' : 
                            agent.status === 'starting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                          }`}></div>
                          <span className="font-medium text-xs sm:text-sm truncate">{agent.name}</span>
                        </div>
                        <button
                          onClick={() => stopAgent(agent.name)}
                          className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                        </button>
                      </div>
                    ))
                  )}
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
  type?: string;
}

const ConfigField: React.FC<ConfigFieldProps> = ({ label, value, onChange, type = 'text' }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
      />
    </div>
  );
};

export default AgentMonitor;