// Test file to verify Groups component can be imported and used
import React from 'react';
import { Groups } from './src/pages/admin/Groups';

// This is a simple test to verify the Groups component can be imported
function TestGroupsImport() {
  console.log('Testing Groups component import...');
  
  try {
    // Try to render the Groups component
    return (
      <div>
        <h1>Groups Import Test</h1>
        <Groups />
      </div>
    );
  } catch (error) {
    console.error('Error importing or rendering Groups component:', error);
    return (
      <div>
        <h1>Import Test Failed</h1>
        <p>Error: {error.message}</p>
      </div>
    );
  }
}

export default TestGroupsImport;