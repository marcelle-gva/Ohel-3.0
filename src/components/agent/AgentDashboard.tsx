import React, { useState } from 'react';

import { AgentHeaderCard } from './AgentHeaderCard';
import { NaturalLanguageInputCard } from './NaturalLanguageInputCard';

export const AgentDashboard: React.FC = () => {
  const [inputValue, setInputValue] = useState('');

  const handleAudioRecord = () => {
    // Placeholder for future audio capture integration.
  };

  return (
    <div className="space-y-6">
      <AgentHeaderCard />
      <NaturalLanguageInputCard
        value={inputValue}
        onChange={setInputValue}
        onAudioRecord={handleAudioRecord}
      />
    </div>
  );
};

export default AgentDashboard;
