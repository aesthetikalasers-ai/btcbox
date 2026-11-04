import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, House, UserRound, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

const items=[{to:"/home",label:"Home",icon:House},{to:"/markets",label:"Markets",icon:ChartNoAxesCombined},{to:"/trade-hub",label:"Trade",icon:ArrowLeftRight},{to:"/assets",label:"Assets",icon:Wallet},{to:"/me",label:"My",icon:UserRound}];
export function BottomNav(){
 const {t}=useI18n();
 return <nav aria-label={t("Primary navigation")} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-brand-border bg-brand-sidebar/95 px-1 pt-2 backdrop-blur-xl lg:hidden" style={{paddingBottom:"max(8px, env(safe-area-inset-bottom))"}}>
  {items.map(({to,label,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold leading-tight transition-colors sm:text-xs",isActive?"text-sky-300":"text-brand-text-muted hover:text-brand-text-secondary")}><Icon className="h-5 w-5 shrink-0"/><span className="max-w-full truncate px-0.5 text-center">{t(label)}</span></NavLink>)}
 </nav>;
}
