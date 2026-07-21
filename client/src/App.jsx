import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import New Overhauled Pages
import LandingPage from './pages/LandingPage';
import AndroidApp from './pages/AndroidApp';
import WebDashboard from './pages/WebDashboard';
import WebLogin from './pages/WebLogin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Entry Portal */}
        <Route path="/" element={<LandingPage />} />

        {/* Android Simulator App View */}
        <Route path="/android" element={<AndroidApp />} />

        {/* Web Dashboard Login */}
        <Route path="/web/login" element={<WebLogin />} />

        {/* Web Researcher Dashboard View (auth-guarded) */}
        <Route path="/web" element={<WebDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
