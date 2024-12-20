import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OAuth from '../../components/OAuth';

import jampng from '../../assets/images/jam1.jpg';
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function SignUp() {
  const [formData, setFormData] = useState({});
  const [err, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({ duration: 500 });
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal mendaftar');
      }

      setLoading(false);
      setError(null);
      navigate('/sign-in');
    } catch (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  return (
    <div className="relative top-0 start-0">
      {err && (
        <div
          data-aos="fade-left"
          id="toast-danger"
          className="flex absolute end-4 z-10 top-3 items-center w-full max-w-xs p-3 md:p-4 mb-4 text-gray-500 bg-white rounded-lg shadow"
          role="alert"
        >
          <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-red-500 bg-red-100 rounded-lg">
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z" />
            </svg>
          </div>
          <div className="ms-3 text-sm font-normal">{err}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ms-auto"
          >
            <svg
              className="w-3 h-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 14 14"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="z-[-1] w-screen flex">
        <div className="bg-[#282831] min-h-screen md:w-6/12"></div>
        <div className="bg-[#0092E8] min-h-screen md:w-6/12"></div>
      </div>

      <div className="hidden sm:block bg-[#0E0E0E]/50 min-h-screen w-screen absolute z-1 start-0 top-0"></div>

      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[3] w-screen md:w-11/12 lg:w-9/12 flex min-h-[95vh] lg:min-h-[90vh] rounded-[30px] bg-white justify-center">
        <div className="hidden sm:block md:w-6/12 relative p-0">
          <div
            className="me-4 text-white m-0 z-[-1] py-8 px-6 bg-center h-full flex items-end bg-cover w-[95%] rounded-[24px]"
            style={{ backgroundImage: `url(${jampng})` }}
          >
            <div>
              <div className="text-[50px] md:me-16 font-bold">SMART DEVICE</div>
              <div className="text-[20px] font-bold">
                <span className="text-[#005A8F]">Vidya</span>Medic
              </div>
              <p className="mt-3">
                "Selamat Datang Kembali! Pantau Kesehatan Anda dengan Lebih
                Cerdas."
              </p>
            </div>
          </div>
          <div className="bg-[#0E0E0E]/50 absolute z-[1] w-full rounded-[29px] h-full start-0 top-0"></div>
        </div>

        <div className="md:w-7/12 flex items-center px-8 lg:px-16">
          <div data-aos="fade-left">
            <h1 className="text-[24px] lg:text-[32px] font-semibold">
              Create Account
            </h1>
            <p className="lg:text-normal md:text-sm">
              Gabung bersama kami dan pantau aktivitas, kesehatan, serta
              kebugaran Anda secara otomatis dengan perangkat pintar.
            </p>

            <form
              onSubmit={handleSubmit}
              className="flex flex-nowrap flex-col gap-4 mt-6 pb-4"
            >
              <input
                id="name"
                onChange={handleChange}
                type="text"
                className="text-gray-900 text-sm rounded-lg bg-[#D9D9D9] block w-full p-2.5"
                placeholder="Masukan nama anda.."
                required
              />
              <input
                id="email"
                onChange={handleChange}
                type="email"
                className="text-gray-900 text-sm rounded-lg bg-[#D9D9D9] block w-full p-2.5"
                placeholder="Masukan email.."
                required
              />
              <input
                id="password"
                onChange={handleChange}
                type="password"
                className="text-gray-900 text-sm rounded-lg bg-[#D9D9D9] block w-full p-2.5"
                placeholder="Masukan Password"
                required
              />
              <input
                id="phone_number"
                onChange={handleChange}
                type="text"
                className="text-gray-900 text-sm rounded-lg bg-[#D9D9D9] block w-full p-2.5"
                placeholder="Masukan no handphone.."
                required
              />
              <button
                type="submit"
                className="text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 font-medium rounded-lg px-5 py-2.5"
              >
                {loading ? 'Loading...' : 'Signup'}
              </button>
              <span className="text-sm">
                Sudah memiliki akun?{' '}
                <Link to="/sign-in" className="text-[#005A8F] underline">
                  Masuk sekarang
                </Link>
              </span>
            </form>

            <div className="flex items-center justify-center">
              <hr className="w-full h-px bg-gray-300 border-0" />
              <span className="px-3 text-gray-500 text-sm">Atau</span>
              <hr className="w-full h-px bg-gray-300 border-0" />
            </div>

            <OAuth />
          </div>
        </div>
      </div>
    </div>
  );
}
