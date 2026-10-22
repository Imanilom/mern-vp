import {
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'monitoring', label: 'Monitoring', icon: LayoutDashboard },
  { id: 'profil', label: 'Profil', icon: UserRound },
  { id: 'deteksi', label: 'Deteksi Dini', icon: ShieldCheck },
  { id: 'prediksi', label: 'Prediksi', icon: Sparkles },
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
  wearable_provider: 'none',
};

export const INITIAL_DASHBOARD = {
  overview: null,
  profile: null,
  insights: null,
  history: [],
  checkIns: [],
  errors: [],
};
