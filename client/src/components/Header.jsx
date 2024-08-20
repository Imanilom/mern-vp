import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';

export default function Header() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  return (
    <header className='bg-slate-200 shadow-md'>
      <div className='flex justify-between items-center max-w-6xl mx-auto p-3'>
        <Link to='/'>
          <h1 className='font-bold text-[18px] sm:text-xl flex flex-wrap'>
            <span className='text-slate-500'>Vidya</span>
            <span className='text-slate-700'>Medic</span>
          </h1>

        </Link>
        <ul className='flex gap-4 items-center font-semibold'>
          <Link to='/'>
            <li className='hidden sm:inline text-slate-700 hover:underline'>
              Home
            </li>
          </Link>
          <Link to='/project'>
            <li className='hidden sm:inline text-slate-700 hover:underline'>
              Project
            </li>
          </Link>

          <Link to='/about'>
            <li className='hidden sm:inline text-slate-700 hover:underline'>
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
              <img src={currentUser.profilePicture} alt='profile' className='h-7 w-7 rounded-full object-cover' />
            ) : (
              <li className='px-3 py-2 rounded-lg hover:text-white text-white lg:text-black lg:bg-transparent bg-slate-700 hover:bg-slate-700 duration-100 font-semibold'>Sign In</li>
            )}
          </Link>
        </ul>
      </div>
    </header>
  );
}
