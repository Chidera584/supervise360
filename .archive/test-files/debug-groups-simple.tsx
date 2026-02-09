// Simple debug version of Groups page to test loading
import React from 'react';

export function DebugGroups() {
  console.log('DebugGroups component rendering...');
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Debug Groups Page</h1>
      <p>If you can see this, the basic component structure works.</p>
      <p>Current time: {new Date().toLocaleString()}</p>
    </div>
  );
}

export default DebugGroups;