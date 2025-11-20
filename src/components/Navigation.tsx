import { Link, useLocation } from 'react-router-dom';

export default function Navigation() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="bg-white shadow-md mb-6">
      <div className="max-w-[1800px] mx-auto px-4">
        <div className="flex items-center space-x-8 h-16">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-gray-900">Invoice Handler</span>
          </div>
          
          <div className="flex space-x-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isActive('/')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Upload
            </Link>
            <Link
              to="/reports"
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isActive('/reports')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Reports
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

