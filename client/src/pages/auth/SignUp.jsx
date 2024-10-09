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
    // <div className='px-3 md:py-8 max-w-lg mx-auto min-h-[90vh] flex flex-col justify-center items-center '>
    //   <h1 className='text-3xl text-center font-semibold my-7'>Sign Up</h1>

    //   <form onSubmit={handleSubmit} className='flex md:min-w-[450px] flex-col gap-4'>
    //     <div className="flex flex-col md:flex-row gap-3">
    //       <input
    //         type='text'
    //         placeholder='guid'
    //         className='border p-3 w-full rounded-lg'
    //         id='guid'
    //         onChange={handleChange}
    //       />
    //       <input
    //         type='text'
    //         placeholder='name'
    //         className='border p-3 w-full rounded-lg'
    //         id='name'
    //         onChange={handleChange}
    //       />
    //     </div>

    //     <div className="flex flex-col md:flex-row gap-3">

    //       <input
    //         type='email'
    //         placeholder='email'
    //         className='border p-3 rounded-lg w-full'
    //         id='email'
    //         onChange={handleChange}
    //       />
    //       <input
    //         type='text'
    //         placeholder='phone'
    //         className='border p-3 rounded-lg w-full'
    //         id='phone_number'
    //         onChange={handleChange}
    //       />
    //     </div>
    //     <div className="flex gap-2 md:gap-4">
    //       <input
    //         type={isHide ? 'password' : 'text'}
    //         placeholder='password'
    //         className='border p-3 rounded-lg w-full'
    //         id='password'
    //         onChange={handleChange}
    //       />

    //       <div className='border hover:opacity-80 h-fit p-3 px-4 rounded-md bg-white cursor-pointer' onClick={() => setIsHide(!isHide)}>
    //         {isHide ? (
    //           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="black" d="M2 5.27L3.28 4L20 20.72L18.73 22l-3.08-3.08c-1.15.38-2.37.58-3.65.58c-5 0-9.27-3.11-11-7.5c.69-1.76 1.79-3.31 3.19-4.54zM12 9a3 3 0 0 1 3 3a3 3 0 0 1-.17 1L11 9.17A3 3 0 0 1 12 9m0-4.5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 0 1-4 5.19l-1.42-1.43A9.86 9.86 0 0 0 20.82 12A9.82 9.82 0 0 0 12 6.5c-1.09 0-2.16.18-3.16.5L7.3 5.47c1.44-.62 3.03-.97 4.7-.97M3.18 12A9.82 9.82 0 0 0 12 17.5c.69 0 1.37-.07 2-.21L11.72 15A3.064 3.064 0 0 1 9 12.28L5.6 8.87c-.99.85-1.82 1.91-2.42 3.13" /></svg>
    //         ) : (
    //           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none"><path d="M24 0v24H0V0zM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" /><path fill="black" d="M12 4c2.787 0 5.263 1.257 7.026 2.813c.885.781 1.614 1.658 2.128 2.531c.505.857.846 1.786.846 2.656s-.34 1.799-.846 2.656c-.514.873-1.243 1.75-2.128 2.531C17.263 18.743 14.786 20 12 20c-2.787 0-5.263-1.257-7.026-2.813c-.885-.781-1.614-1.658-2.128-2.531C2.34 13.799 2 12.87 2 12s.34-1.799.846-2.656c.514-.873 1.243-1.75 2.128-2.531C6.737 5.257 9.214 4 12 4m0 2c-2.184 0-4.208.993-5.702 2.312c-.744.656-1.332 1.373-1.729 2.047C4.163 11.049 4 11.62 4 12s.163.951.569 1.641c.397.674.985 1.39 1.729 2.047C7.792 17.007 9.816 18 12 18s4.208-.993 5.702-2.312c.744-.657 1.332-1.373 1.729-2.047c.406-.69.569-1.261.569-1.641s-.163-.951-.569-1.641c-.397-.674-.985-1.39-1.729-2.047C16.208 6.993 14.184 6 12 6m0 3q.132 0 .261.011a2 2 0 0 0 2.728 2.728A3 3 0 1 1 12 9" /></g></svg>
    //         )}
    //       </div>

    //     </div>

    //     <button
    //       disabled={loading}
    //       className='bg-slate-700 text-white p-3 rounded-lg uppercase hover:opacity-95 disabled:opacity-80'
    //     >
    //       {loading ? 'Loading...' : 'Sign Up'}
    //     </button>
    //     <p className='text-center'>Or</p>
    //     <OAuth />
    //   </form>
    //   <div className='flex gap-2 mt-5'>
    //     <p>Have an account?</p>
    //     <Link to={'/sign-in'}>
    //       <span className='text-blue-700'>Sign in</span>
    //     </Link>
    //   </div>

    //   {error && <p className='text-red-500 mt-5'>{error}</p>}
    // </div>

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
            <div className="flex md:flex-row lg:flex-col gap-3">
                <div className='min-w-sm'>
                  <input id="name" onChange={handleChange} type="text" class=" text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan nama anda.." required />
                </div>
              <div>
                <input id="guid" onChange={handleChange} type="text" class=" text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan guid device.." required />
              </div>

            </div>
              <div className="flex lg:flex-row  gap-3">
                <div>
                  <input id="email" onChange={handleChange} type="text" class="max-w-sm text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan email.." required />
                </div>
                <div>
                  <input id="phone_number" onChange={handleChange} type="text" class="max-w-sm text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan no handphone.." required />
                </div>
              </div>
              <div className="flex lg:flex-row gap-3">
                <div>
                  <input id="password" onChange={handleChange} type="password" class="max-w-sm text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 bg-[#D9D9D9] dark:border-gray-600 dark:placeholder-gray-500" placeholder="Masukan Password" required />
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
