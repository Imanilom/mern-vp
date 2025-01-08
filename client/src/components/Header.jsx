import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import ButtonOffCanvas from './ButtonOffCanvas.jsx';
import { current } from '@reduxjs/toolkit';

export default function Header() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [isLightMode_, setLightMode] = useState(window.localStorage.getItem('_isLightMode'));
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();

  const changeTheme = (type) => {
    if (type == 'light') {
     
      localStorage.setItem('_isLightMode', true);
      window.location.reload();
    } else {
    
      localStorage.setItem('_isLightMode', false)
      window.location.reload();
    }
  }

  useEffect(() => {
    if (isLightMode_ === 'true') {
      document.body.classList.add('dark'); // sengaja di balik, karena waktu awal develop pake tema gelap
    } else {
      document.body.classList.remove('dark');
    }
  }, [isLightMode_]);

  return (
    <header className='bg-[#101010] dark:bg-[#fefcf5] shadow-md'>
      <div className="flex-col flex gap-2 mx-auto">
        <div className='flex items-center md:px-[10vw] justify-between p-6'>
          <Link to='/'>
            <h1 className='font-bold text-[18px] sm:text-xl flex flex-wrap'>
              <span className='text-[#005A8F]'>Vidya</span>
              <span className='text-white dark:text-[#217170]'>Medic</span>
            </h1>
          </Link>

          {/* Navigation and Actions */}
          {/* <div className="flex items-center gap-4 font-medium dark:text-[#073B4C] text-[#ffffff] "> */}
          <div className="flex items-center gap-2">
            {/* Sign In/Sign Up Buttons */}
            {!currentUser ? (
              <Link to={`/sign-in`}>
                <div className="px-5 py-1.5 bg-[#017bc2] hover:opacity-90 rounded-[5px] text-white font-semibold">
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

            {/* Theme Toggle */}
            {currentUser ? (
              <div className="flex me-1 items-center gap-2 bg-[#2C2C2C] dark:text-[#073B4C] text-white dark:bg-[#F5F2E7] px-4 py-2 rounded-md">
                <span className='text-sm font-semibold pe-1 hidden md:block'>Choose Theme</span>
                <div
                  onClick={() => changeTheme('light')}
                  className="p-2 rounded text-sm font-semibold cursor-pointer bg-transparent dark:bg-white flex gap-1 items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 19a1 1 0 0 1 .993.883L13 20v1a1 1 0 0 1-1.993.117L11 21v-1a1 1 0 0 1 1-1m6.313-2.09l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7a1 1 0 0 1 1.218-1.567zm-11.306.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M4 11a1 1 0 0 1 .117 1.993L4 13H3a1 1 0 0 1-.117-1.993L3 11zm17 0a1 1 0 0 1 .117 1.993L21 13h-1a1 1 0 0 1-.117-1.993L20 11zM6.213 4.81l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7A1 1 0 0 1 6.11 4.74zm12.894.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M12 2a1 1 0 0 1 .993.883L13 3v1a1 1 0 0 1-1.993.117L11 4V3a1 1 0 0 1 1-1m0 5a5 5 0 1 1-4.995 5.217L7 12l.005-.217A5 5 0 0 1 12 7" />
                  </svg>
                  <p className='dark:block hidden'>Light</p>
                </div>
                <div
                  onClick={() => changeTheme('dark')}
                  className="p-2 rounded text-sm font-semibold cursor-pointer bg-[#07AC7B] dark:bg-transparent flex gap-1 items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 22c5.523 0 10-4.477 10-10c0-.463-.694-.54-.933-.143a6.5 6.5 0 1 1-8.924-8.924C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10" />
                  </svg>
                  <p className='dark:hidden block'>Dark</p>
                </div>
              </div>
            ) : null}

            {currentUser ? (
              <ButtonOffCanvas index={11} />
            ) : null}
          </div>
        </div>

        <div className="flex items-center  md:px-[10vw] border-b border-t gap-4 border-[#ffffff31] dark:border-[#073b4c33] justify-end font-semibold text-sm py-3 text-white dark:text-[#073B4C]">
          <Link to="/">
            <p className="">Home</p>
          </Link>
          <Link to="/project">
            <p className="">Project</p>
          </Link>
          <Link to="/about">
            <p className="">About</p>
          </Link>

          {DocterPatient && currentUser?.role === 'doctor' ? (
            <Link to="/ringkasan-pasien" onClick={() => window.localStorage.setItem('active_nav', 'ringkasan')}>
              <p className="">Dashboard</p>
            </Link>
          ) : null}

          {!DocterPatient && currentUser?.role === 'doctor' ? (
            <Link to="/my-patients" onClick={() => window.localStorage.setItem('active_nav', 'my-patient')}>
              <p className="">My Patients</p>
            </Link>
          ) : null}

          {currentUser && currentUser.role !== 'doctor' ? (
            <Link to="/ringkasan-pasien" onClick={() => window.localStorage.setItem('active_nav', 'ringkasan')}>
              <p className="">Dashboard</p>
            </Link>
          ) : null}
          {currentUser ? (
            <Link to="/profile">
              <img
                src={currentUser.profilePicture}
                alt="profile"
                className="h-[44px] w-[44px] rounded-full object-cover shadow-md"
              />
            </Link>
          ) : null}
        </div>
      </div>
    </header >
  );
}
