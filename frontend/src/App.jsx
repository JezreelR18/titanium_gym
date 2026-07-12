import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/auth/Login";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/dashboard/Dashboard";
import MembersList from "./pages/members/MembersList";
import UsersList from "./pages/users/UsersList";
import RolesList from "./pages/roles/RolesList";
import InventoryPage from "./pages/inventory/InventoryPage";
import SalesPage from "./pages/sales/SalesPage";
import MembershipsPage from "./pages/memberships/MembershipsPage";
import TrainingPage from "./pages/training/TrainingPage";
import AttendancePage from "./pages/attendance/AttendancePage";
import ClassesPage from "./pages/classes/ClassesPage";
import LockersPage from "./pages/lockers/LockersPage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import CashRegisterPage from "./pages/cash-register/CashRegisterPage";
import ProfilePage from "./pages/profile/ProfilePage";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="members"      element={<MembersList />} />
        <Route path="users"        element={<UsersList />} />
        <Route path="roles"        element={<RolesList />} />
        <Route path="sales"        element={<SalesPage />} />
        <Route path="inventory"    element={<InventoryPage />} />
        <Route path="memberships"  element={<MembershipsPage />} />
        <Route path="attendance"   element={<AttendancePage />} />
        <Route path="classes"      element={<ClassesPage />} />
        <Route path="lockers"        element={<LockersPage />} />
        <Route path="notifications"  element={<NotificationsPage />} />
        <Route path="training"        element={<TrainingPage />} />
        <Route path="cash-register"   element={<CashRegisterPage />} />
        <Route path="profile"          element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
