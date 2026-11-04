import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, House, UserRound, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";

const items=[
 {to:"/home",label:"Home",icon:House},
 {to:"/markets",label:"Markets",icon:ChartNoAxesCombined},
 {to:"/trade-hub",label:"Trade",icon:ArrowLeftRight},
 {to:"/assets",label:"Assets",icon:Wallet},
 {to:"/me",label:"My",icon:UserRound},
];
export function BottomNav(){
 return <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.08] bg-[#0b0c0ef2] px-1 pt-2 backdrop-blur-xl lg:hidden" style={{paddingBottom:"max(8px, env(safe-area-inset-bottom))"}}>
  {items.map(({to,label,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors",isActive?"text-white":"text-zinc-500 hover:text-zinc-300")}><Icon className="h-[19px] w-[19px]"/><span>{label}</span></NavLink>)}
 </nav>;
}
