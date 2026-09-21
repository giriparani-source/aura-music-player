import React from 'react';
import { HashRouter } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <MainLayout />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;

