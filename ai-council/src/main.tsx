import React from 'react';
import ReactDOM from 'react-dom/client';
import AgentMonitor from './components/agent-monitor-ui';
import './index.css'; // Tailwind / CSS imports

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AgentMonitor />
  </React.StrictMode>
);
