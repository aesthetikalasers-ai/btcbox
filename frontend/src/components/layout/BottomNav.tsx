import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, House, UserRound, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

const navLinks = [
  { to: "/home", label: "Home", icon: House, exact: true },
  { to: "/markets", label: "Markets", icon: ChartNoAxesCombined, exact: false },
  { to: "/trade", label: "Trade", icon: ArrowLeftRight, exact: false },
  { to: "/assets", label: "Assets", icon: Wallet, exact: true },
  { to: "/me", label: "My", icon: UserRound, exact: true },
] as const;

export function BottomNav() {
  const { t } = useI18n();

  return (
    <nav
      aria-label="Primary navigation"
      className="bf-bottom-nav lg:hidden"
      style={{ zIndex: 40 }}
    >
      {navLinks.map(({ to, label, icon: Icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) =>
            cn("bf-bottom-nav-item", isActive && "bf-bottom-nav-item--active")
          }
        >
          <Icon className="bf-nav-icon" />
          <span className="bf-bottom-nav-label">{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
