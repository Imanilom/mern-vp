import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import ButtonOffCanvas from './ButtonOffCanvas.jsx';

export default function Header() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [isLightMode_, setLightMode] = useState(window.localStorage.getItem('_isLightMode'))
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const changeTheme = (type) => {
    if (type == 'light') {
      console.log('light');
      localStorage.setItem('_isLightMode', true);
      window.location.reload();

    } else {
      console.log('dark')
      localStorage.setItem('_isLightMode', false)
      window.location.reload();
    }
  }

  useEffect(() => {
    if (isLightMode_ == 'true') {
      console.log('add')
      document.body.classList.add('dark'); // sengaja di balik, karena waktu awal develop pake tema gelap
    } else {
      console.log('remove')
      document.body.classList.remove('dark');
    }
  })

  return (
    <header className='bg-[#101010] dark:bg-[#fefcf5] shadow-md'>
      <div className='flex justify-between items-center max-w-6xl mx-auto p-6'>
        <Link to='/'>
          <h1 className='font-bold text-[18px] sm:text-xl flex flex-wrap'>
            <span className='blue'>Vidya</span>
            <span className='text-white dark:text-[#217170]'>Medic</span>
          </h1>
        </Link>
        <div className="flex items-center gap-2">
          {!currentUser ? (
            <Link to={`/sign-in`}>
              <div className="px-5 py-1.5 bgg-b hover:opacity-90 rounded-[5px] text-white font-semibold">
                Sign in
              </div>
            </Link>
          ) : null}
          {!currentUser ? (
            <Link to={`/sign-up`}>
              <div className="px-5 py-1.5  rounded-[5px] dark:text-[#073B4C] text-white/90 hover:text-[#017bc2] font-semibold">
                Sign up
              </div>
            </Link>
          ) : null}
          {currentUser ? (

            <div className='px-5 py-2 rounded-md bg-[#181818] dark:bg-[#f6f6f6] flex items-center  gap-3 dark:text-[#073B4C]  text-white me-2'>
              {/* <span className='font-semibold text-sm dark:text-[#217170] block md:hidden'>Theme</span> */}
              <span className='font-semibold text-sm whitespace-nowrap dark:text-[#217170] md:block hidden'>Choose Theme</span>
              <div onClick={() => changeTheme('light')} className="flex bg-transparent dark:bg-white items-center p-2 gap-2 cursor-pointer rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 19a1 1 0 0 1 .993.883L13 20v1a1 1 0 0 1-1.993.117L11 21v-1a1 1 0 0 1 1-1m6.313-2.09l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7a1 1 0 0 1 1.218-1.567zm-11.306.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M4 11a1 1 0 0 1 .117 1.993L4 13H3a1 1 0 0 1-.117-1.993L3 11zm17 0a1 1 0 0 1 .117 1.993L21 13h-1a1 1 0 0 1-.117-1.993L20 11zM6.213 4.81l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7A1 1 0 0 1 6.11 4.74zm12.894.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M12 2a1 1 0 0 1 .993.883L13 3v1a1 1 0 0 1-1.993.117L11 4V3a1 1 0 0 1 1-1m0 5a5 5 0 1 1-4.995 5.217L7 12l.005-.217A5 5 0 0 1 12 7" /></svg>

                {/* <span className='font-semibold pe-1'>
                Light Mode
              </span> */}
              </div>
              <div onClick={() => changeTheme('dark')} className="flex items-center p-2 gap-2 rounded-md cursor-pointer bg-[#07AC7B] dark:bg-transparent">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22c5.523 0 10-4.477 10-10c0-.463-.694-.54-.933-.143a6.5 6.5 0 1 1-8.924-8.924C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10" /></svg>

                {/* <span className='font-semibold '>
                Dark Mode
              </span> */}
              </div>
            </div>
          ) : null}

          {currentUser ? (
            <ButtonOffCanvas index={11} />
          ) : null}
        </div>
      </div>
      <div className="flex py-3 border-t border-b justify-end border-[#363636]/30">
        <ul className='flex gap-4 text-sm items-center font-medium max-w-6xl me-[8%] dark:text-[#073B4C] text-white'>
          <Link to='/'>
            <li className=' sm:inline hover:underline'>
              Home
            </li>
          </Link>
          <Link to='/project'>
            <li className=' sm:inline hover:underline'>
              Project
            </li>
          </Link>

          <Link to='/about'>
            <li className=' sm:inline hover:underline'>
              About
            </li>
          </Link>

          {DocterPatient && currentUser.role == 'doctor' ? (
            <Link to='/ringkasan-pasien'>
              {currentUser ? (
                <p>Dashboard</p>
              ) : (
                <li className=' text-slate-700 hover:underline'></li>
              )}
            </Link>
          ) : null}

          {!DocterPatient && currentUser && currentUser.role == 'doctor' ? (
            <Link to='/my-patients'>
              {currentUser ? (
                <p>My Patients</p>
              ) : (
                <li className=' text-slate-700 hover:underline'></li>
              )}
            </Link>
          ) : null}

          {currentUser && currentUser.role != 'doctor' ? (
            <Link to='/ringkasan-pasien'>
              {currentUser ? (
                <p>Dashboard</p>
              ) : (
                <li className=' text-slate-700 hover:underline'></li>
              )}
            </Link>
          ) : null}

          <Link to='/profile'>
            {currentUser ? (
              <img src={currentUser.profilePicture} alt='profile' className='h-[44px] dark:shadow-lg w-[44px] rounded-full object-cover shadow-gray-500/60' />
            ) : null}
          </Link>
        </ul>

      </div>
    </header>
  );
}
