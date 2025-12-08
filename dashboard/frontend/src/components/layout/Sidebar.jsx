// ============================================
// FILE: frontend/src/components/layout/Sidebar.jsx (NEW)
// Complete sidebar navigation component
// ============================================
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ isOpen, isMobileOpen, onClose }) {
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      icon: '📊',
      href: '/dashboard',
      active: location.pathname === '/dashboard',
    },
    {
      name: 'Organizations',
      icon: '🏢',
      href: '/organizations',
      active: location.pathname.startsWith('/organizations'),
    },
    {
      name: 'Questions',
      icon: '📝',
      href: '/questions',
      active: location.pathname.startsWith('/questions'),
    },
    {
      name: 'Surveys',
      icon: '📋',
      href: '/surveys',
      active: location.pathname.startsWith('/surveys'),
    },
    {
      name: 'Analytics',
      icon: '📈',
      href: '/analytics',
      active: location.pathname.startsWith('/analytics'),
    },
    {
      name: 'API Keys',
      icon: '🔑',
      href: '/api-keys',
      active: location.pathname.startsWith('/api-keys'),
    },
    {
      name: 'Webhooks',
      icon: '🔗',
      href: '/webhooks',
      active: location.pathname.startsWith('/webhooks'),
    },
    {
      name: 'Settings',
      icon: '⚙️',
      href: '/settings',
      active: location.pathname.startsWith('/settings'),
    },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 transition-all duration-300 hidden lg:block ${
          isOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200">
            <div className="flex items-center gap-3 px-4">
              <div className="text-3xl">📊</div>
              {isOpen && (
                <div className="font-bold text-xl text-gray-900 whitespace-nowrap">
                  Dashboard
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={!isOpen ? item.name : undefined}
              >
                <span className="text-2xl">{item.icon}</span>
                {isOpen && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <div className="text-sm text-gray-500 text-center">
              {isOpen ? 'v2.0.0' : 'v2'}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-300 lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Close button */}
          <div className="flex items-center justify-between h-16 border-b border-gray-200 px-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📊</div>
              <div className="font-bold text-xl text-gray-900">Dashboard</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
