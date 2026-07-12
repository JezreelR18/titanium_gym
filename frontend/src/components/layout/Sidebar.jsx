import { NavLink, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Users, CreditCard, ShoppingCart,
  Calendar, Clipboard, Package, Bell, Dumbbell, LogOut,
  UserCog, Shield, Lock, Calculator, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { notificationService } from "../../services/notificationService";
import clsx from "clsx";

const mainNav = [
  { to: "/dashboard",     label: "Inicio",          icon: LayoutDashboard },
  { to: "/members",       label: "Miembros",        icon: Users },
  { to: "/memberships",   label: "Membresías",      icon: CreditCard },
  { to: "/sales",         label: "Ventas",          icon: ShoppingCart },
  { to: "/classes",       label: "Clases",          icon: Calendar },
  { to: "/attendance",    label: "Asistencia",      icon: Clipboard },
  { to: "/training",      label: "Entrenamiento",   icon: Dumbbell },
  { to: "/lockers",       label: "Casilleros",      icon: Lock },
  { to: "/inventory",     label: "Inventario",      icon: Package },
  { to: "/cash-register", label: "Corte de caja",   icon: Calculator },
  { to: "/notifications", label: "Notificaciones",  icon: Bell, badge: true },
];

const adminNav = [
  { to: "/users", label: "Usuarios", icon: UserCog },
  { to: "/roles", label: "Roles",    icon: Shield  },
];

function NavItem({ to, label, icon: Icon, alertCount, vc, onMobileClose }) {
  return (
    <NavLink
      to={to}
      onClick={onMobileClose}
      title={vc ? label : undefined}
      className={({ isActive }) =>
        clsx(
          "relative flex items-center rounded-lg text-sm font-medium transition-colors",
          vc ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-brand-600 text-white"
            : "text-gray-400 hover:bg-gray-800 hover:text-white"
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      {!vc && <span className="flex-1 truncate">{label}</span>}
      {!vc && alertCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {alertCount > 99 ? "99+" : alertCount}
        </span>
      )}
      {vc && alertCount > 0 && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
      )}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }) {
  const { logout, user } = useAuth();
  const roleName = user?.role?.name ?? "";
  const isAdmin = ["propietario", "administrador"].includes(roleName.toLowerCase());

  // On mobile the drawer always shows expanded regardless of desktop collapsed state
  const vc = collapsed && !mobileOpen;

  const { data: countData } = useQuery({
    queryKey: ["alert-count"],
    queryFn: notificationService.getAlertCount,
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const alertCount = countData?.count ?? 0;

  return (
    <aside
      className={clsx(
        "bg-gray-900 text-white flex flex-col transition-all duration-300 shrink-0",
        // Mobile: fixed drawer, always w-64
        "fixed inset-y-0 left-0 z-30 w-64",
        mobileOpen ? "flex" : "hidden",
        // Desktop: sticky in normal flow, collapsible width
        "lg:relative lg:flex lg:sticky lg:top-0 lg:h-screen",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          "flex items-center border-b border-gray-800 shrink-0",
          vc ? "justify-center py-4" : "px-4 py-4"
        )}
      >
        {!vc && (
          <div className="flex-1 min-w-0 px-2">
            <h1 className="text-lg font-bold text-brand-400 truncate">Titanium Gym</h1>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{user?.role?.name}</p>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav
        className={clsx(
          "flex-1 py-3 space-y-0.5 overflow-y-auto",
          vc ? "px-1" : "px-3"
        )}
      >
        {mainNav.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            alertCount={item.badge ? alertCount : 0}
            vc={vc}
            onMobileClose={onMobileClose}
          />
        ))}

        {isAdmin && (
          <>
            {!vc ? (
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
                  Administración
                </p>
              </div>
            ) : (
              <div className="my-2 border-t border-gray-800" />
            )}
            {adminNav.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                alertCount={0}
                vc={vc}
                onMobileClose={onMobileClose}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer: profile + logout */}
      <div
        className={clsx(
          "border-t border-gray-800 py-3 shrink-0",
          vc ? "px-1" : "px-3"
        )}
      >
        <Link
          to="/profile"
          onClick={onMobileClose}
          title={vc ? `${user?.first_name} ${user?.last_name}` : undefined}
          className={clsx(
            "flex items-center rounded-lg hover:bg-gray-800 transition-colors group mb-1",
            vc ? "justify-center py-2.5" : "gap-3 px-3 py-2"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          {!vc && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-white">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-400 truncate">Mi perfil</p>
            </div>
          )}
        </Link>

        <button
          onClick={logout}
          title={vc ? "Cerrar sesión" : undefined}
          className={clsx(
            "flex items-center w-full rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors",
            vc ? "justify-center py-2.5" : "gap-3 px-3 py-2.5"
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!vc && "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
