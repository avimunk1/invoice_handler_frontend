import { Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import UploadPage from './components/UploadPage';
import ReportsPage from './components/ReportsPage';
import './App.css';

function App() {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </>
  );
}

export default App;
