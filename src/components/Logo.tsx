import logo from "@/assets/lnpats-logo.jpg.asset.json";

export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return <img src={logo.url} alt="LNPATS logo" className={`${className} rounded-full bg-card object-contain`} />;
}
