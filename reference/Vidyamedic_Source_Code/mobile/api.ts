export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';
export interface Point { timestamp: string; label: string; hr: number; expected: number; rmssd: number; activity: string; quality: number; origin: string }
export interface Dashboard { demo: boolean; subject: string; as_of: string; vitals: {hr_bpm:number; rmssd_ms:number; rr_ms:number; steps:number; data_quality_pct:number}; summary: {episodes:number; unresolved:number; recovery_episodes:number; monitoring_days:number}; last_event: {id:string;time:string;observed_hr_bpm:number;resting_expected_bpm:string;status:string;context:string}; series: Point[]; disclaimer:string }
export interface Insight {engine:string;is_llm:boolean;observed:string;interpretation:string;context:string;confidence:string;recovery:string;recommendations:string[];disclaimer:string}
export interface Profile {id:string;name:string;synthetic:boolean;age:number;baseline_maturity:string;baseline:{context:string;hr_min:number;hr_max:number;rmssd_min:number;rmssd_max:number;evidence:string}[];goals:string[]}
export interface BI {period_days:number;trends:{index:number;mean_hr:number;recovery_minutes:number;quality_pct:number}[];metrics:{average_hr:number;episodes:number;average_recovery_minutes:number;quality_pct:number};activity_distribution:{context:string;percent:number}[]}
export interface Recs {items:{id:string;title:string;description:string;status:string;priority:string}[]}
export async function api<T>(path:string, init?:RequestInit):Promise<T>{
  const timeout = new AbortController();
  const timer = setTimeout(()=>timeout.abort(),12000);
  try {
    const r = await fetch(API_URL+path,{...init,signal:timeout.signal,headers:{'Content-Type':'application/json',...init?.headers}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json() as T;
  } finally {clearTimeout(timer)}
}
