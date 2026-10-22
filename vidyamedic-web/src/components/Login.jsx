import { useState } from 'react';
import {
  AlertCircle,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';
import { api, clearToken } from '../api';
import Brand from './Brand';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Masukkan email dan kata sandi.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.signin(email.trim(), password);
      const user = await api.me();
      onLogin(user);
    } catch (reason) {
      setError(reason.message || 'Tidak dapat masuk. Periksa koneksi dan akun.');
      clearToken();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Brand />
        <div className="login-heading">
          <span className="eyebrow">RUANG KESEHATAN PERSONAL</span>
          <h1>Selamat datang kembali</h1>
          <p>Masuk untuk melihat catatan kesehatan Anda.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@email.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            Kata sandi
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi"
              type="password"
              value={password}
            />
          </label>
          {error && <div className="form-error"><AlertCircle size={16} />{error}</div>}
          <button className="button button-primary login-submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={17} />}
            {busy ? 'Memeriksa akun...' : 'Masuk ke Vidyamedic'}
          </button>
        </form>
        <p className="login-privacy">
          Data kesehatan hanya ditampilkan setelah Anda masuk.
        </p>
      </section>
      <div className="login-decoration">
        <div className="decoration-orbit orbit-one" />
        <div className="decoration-orbit orbit-two" />
        <div className="decoration-orbit orbit-three" />
        <div className="decoration-center"><HeartPulse size={50} /></div>
      </div>
    </main>
  );
}
