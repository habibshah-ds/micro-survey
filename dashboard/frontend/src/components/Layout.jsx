import React, { useContext } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link to="/dashboard" className="flex items-center text-gray-900 font-semibold">
                Dashboard
              </Link>
              <Link to="/organizations" className="flex items-center text-gray-600 hover:text-gray-900">
                Organizations
              </Link>
              <Link to="/questions" className="flex items-center text-gray-600 hover:text-gray-900">
                Questions
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
