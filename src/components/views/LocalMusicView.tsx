import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Pure Cloud Streaming Migration:
 * Local device files have been replaced with 100% cloud streaming.
 * Navigations to /local are cleanly redirected to /library.
 */
export const LocalMusicView: React.FC = () => {
  return <Navigate to="/library" replace />;
};
