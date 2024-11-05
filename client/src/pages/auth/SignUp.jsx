import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OAuth from '../../components/OAuth';

import jampng from '../../assets/images/jam1.jpg';
import { FcGoogle } from "react-icons/fc";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function SignUp() {
  const [formData, setFormData] = useState({});
  const [err, setError] = useState(null);
  const [isHide, setIsHide] = useState(true)
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({
      duration: 500
    })
  }, [])
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      console.log(data);
      if (data.success === false) {
        setLoading(false);
        setError(data.message);
        return;
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

      {/* toast */}
      {err ? (
        <div data-aos="fade-left" id="toast-danger" class="flex absolute end-4 z-10 top-3 items-center w-full max-w-xs p-3 md:p-4 mb-4 text-gray-500 bg-white rounded-lg shadow " role="alert">
          <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-red-500 bg-red-100 rounded-lg dark:bg-red-800 dark:text-red-200">
            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z" />
            </svg>
            <span class="sr-only">Error icon</span>
          </div>
          <div class="ms-3 text-sm font-normal">{err}.</div>
          <button type="button" onClick={() => setError(null)} className='ms-auto' data-dismiss-target="#toast-danger" aria-label="Close">
            <span class="sr-only">Close</span>
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className='z-[-1] w-screen flex '>
        <div className="bg-[#282831] min-h-screen md:w-6/12"></div>
        <div className="bg-[#0092E8] min-h-screen  md:w-6/12"></div>

      </div>
      <div className="hidden sm:block bg-[#0E0E0E]/50 min-h-screen w-screen absolute z-1 start-0 top-0"></div>

      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[3] w-screen md:w-11/12 lg:w-9/12 flex min-h-[95vh] lg:min-h-[90vh] rounded-[30px] bg-white justify-center ">
        <div className="hidden sm:block md:w-6/12 relative p-0">
          <div className="me-4 text-white m-0 z-[-1] py-8 px-6 bg-center h-full flex items-end bg-cover w-[95%] rounded-[24px]" style={{ backgroundImage: `url(${jampng})` }}>
            <div>

              <div className="text-[50px] md:me-16 font-bold">
                SMART DEVICE
              </div>
              <div className="text-[20px] font-bold">
                <span className='blue'>Vidya</span>Medic
              </div>
              <p className='mt-3'>
                "Selamat Datang Kembali!  Pantau Kesehatan Anda dengan Lebih Cerdas."
              </p>
            </div>
          </div>
          <div className="bg-[#0E0E0E]/50 absolute z-[1] w-full rounded-[29px] h-full start-0 top-0"></div>
        </div>
        <div className="md:w-7/12 flex items-center px-8 lg:px-16">
          <div data-aos="fade-left">
            <h1 className='text-[24px] lg:text-[32px] font-semibold'>
              Create Account
            </h1>
            <p className='lg:text-normal md:text-sm'>Gabung bersama kami dan pantau aktivitas, kesehatan, serta kebugaran Anda secara otomatis dengan perangkat pintar.</p>
            <form onSubmit={handleSubmit} className='flex flex-nowrap flex-col gap-4 mt-6 pb-4 ' action="" method="post">
              <div className="flex flex-col md:flex-row lg:flex-col gap-3">
                <div className='min-w-sm'>
                  <input id="name" onChange={handleChange} type="text" class=" text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan nama anda.." required />
                </div>
                <div>
                  {/* <input id="guid" onChange={handleChange} type="text" class=" text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan guid device.." required /> */}
                  <input id="email" onChange={handleChange} type="text" class="text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan email.." required />
                </div>
                <div>
                  <input id="password" onChange={handleChange} type="password" class="text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan Password" required />
                </div>

              </div>

              <div className="flex lg:flex-row gap-3">
                <div>
                  <input id="phone_number" onChange={handleChange} type="text" class="max-w-sm text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan no handphone.." required />
                </div>

                <button type="submit" class="text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2">Signup</button>

              </div>
              <span className='text-sm'>Sudah memiliki akun? <Link to={'/sign-in'} className='blue underline'>Masuk sekarang</Link></span>

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
