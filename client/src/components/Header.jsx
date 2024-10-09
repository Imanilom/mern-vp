import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import ButtonOffCanvas from './ButtonOffCanvas.jsx';

export default function Header() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  return (
    <header className='bg-[#101010] shadow-md'>
      <div className='flex justify-between items-center max-w-6xl mx-auto p-6'>
        <Link to='/'>
          <h1 className='font-bold text-[18px] sm:text-xl flex flex-wrap'>
            <span className='blue'>Vidya</span>
            <span className='text-white'>Medic</span>
          </h1>
        </Link>
        <div className="flex gap-2">
          {!currentUser ? (
            <Link to={`/sign-in`}>
              <div className="px-5 py-1.5 bgg-b hover:opacity-90 rounded-[5px] text-white font-semibold">
                Sign in
              </div>
            </Link>
          ) : null}
          {!currentUser ? (
            <Link to={`/sign-up`}>
              <div className="px-5 py-1.5  rounded-[5px] text-white/90 hover:text-[#017bc2] font-semibold">
                Sign up
              </div>
            </Link>
          ) : null}

          {currentUser ? (
            <ButtonOffCanvas index={11} />
          ) : null}
        </div>
      </div>
      <div className="flex py-3 border-t border-b justify-end border-[#363636]/30">
        <ul className='flex gap-4 text-sm items-center font-medium max-w-6xl me-[8%] text-white'>
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
              <img src={currentUser.profilePicture} alt='profile' className='h-[44px] shadow-md shadow-white/5 w-[44px] rounded-full object-cover' />
            ) : null}
          </Link>
        </ul>

      </div>
    </header>
  );
}
