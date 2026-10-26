import {
  BarChart3,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoring', icon: LayoutDashboard },
  { id: 'profil', label: 'Profil Kesehatan', icon: UserRound },
  { id: 'insight', label: 'Business Intelligence', icon: BarChart3 },
  { id: 'deteksi', label: 'AI & Deteksi Dini', icon: ShieldCheck },
  { id: 'prediksi', label: 'Rekomendasi & Keputusan', icon: Sparkles },
  { id: 'laporan', label: 'Laporan', icon: FileText },
  { id: 'administrasi', label: 'Administrasi', icon: SlidersHorizontal },
];

export const INITIAL_PROFILE = {
  date_of_birth: '',
  sex: '',
  height_cm: '',
  weight_kg: '',
  blood_type: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  goal: 'daily_monitoring',
  monitoring_priority: 'activity_rest',
  wearable_provider: 'none',
};

export const INITIAL_DASHBOARD = {
  overview: null,
  profile: null,
  insights: null,
  history: [],
  checkIns: [],
  patientActions: [],
  errors: [],
};
