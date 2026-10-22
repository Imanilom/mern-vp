import { HeartPulse } from 'lucide-react';

export default function Brand() {
  return (
    <div className="brand">
      <div className="brand-symbol"><HeartPulse size={22} strokeWidth={2.5} /></div>
      <span>vidyamedic<span className="brand-dot">.</span></span>
    </div>
  );
}
