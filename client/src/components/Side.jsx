// Sidebar.js
import React from 'react';
import { Link } from 'react-router-dom';
// import { Sidebar, Menu, div } from "react-pro-sidebar";
import '../loading.css';

import { useSelector } from 'react-redux';
import { FaUser } from "react-icons/fa";
import { GiNotebook } from "react-icons/gi";
import { TbHeartRateMonitor } from "react-icons/tb";
import { FaRunning } from "react-icons/fa";
import { FaFileMedical } from "react-icons/fa6";
import { MdOnlinePrediction } from "react-icons/md";




const Side = () => {
  const { currentUser, loading, error, DocterPatient } = useSelector((state) => state.user);
  console.log('docter : ', DocterPatient == null, DocterPatient);
  return (
    <>
      <div className="hidden py-[5vh] bg-[#101010] relative lg:flex flex-col text-white/90 h-auto w-full max-w-[17rem] shadow-xl">
        <div>
          <div className='bg-[#101010] py-[10] hover:bg-[#101010] shadow-none border-none outline-none text-white/90 flex-col flex'>

            {currentUser.role != 'user' && DocterPatient == null ? (
              //show only for admin
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/my-patients'>
                <div className=''>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaUser size={20} />
                    </div>
                    My Patients
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}

            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/ringkasan-pasien'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaUser size={20} />
                    </div>
                    Ringkasan Pasien
                  </div>
                </div>
              </Link>
            ) : null}
            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/ringkasan-pasien'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaUser size={20} />
                    </div>
                    Ringkasan Pasien
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}
            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/monitor'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <TbHeartRateMonitor size={24} />
                    </div>
                    Monitoring
                  </div>
                </div>
              </Link>

            ) : null}

            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/monitor'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <TbHeartRateMonitor size={24} />
                    </div>
                    Monitoring
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}

            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/activity'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaRunning size={24} />
                    </div>
                    Aktivitas
                  </div>
                </div>
              </Link>

            ) : null}

            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/activity'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaRunning size={24} />
                    </div>
                    Aktivitas
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}

            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/riwayat-medis'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaFileMedical size={20} />

                    </div>
                    Riwayat Medis
                  </div>
                </div>
              </Link>
            ) : null}

            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/riwayat-medis'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <FaFileMedical size={20} />
                    </div>
                    Riwayat Medis
                  </div>
                </div>
              </Link>
            ) : null}

            {currentUser.role != 'user' ? (
              //show only for admin
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/faktor-resiko'>
                <div>
                  <div role="button" tabindex="0" class="flex p-3 items-center w-full rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <GiNotebook size={24} />
                    </div>
                    Faktor Resiko
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}
            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/prediksi-faktor'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <MdOnlinePrediction size={24} />
                    </div>
                    Prediksi Faktor
                  </div>
                </div>
              </Link>
            ) : null}

            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/prediksi-faktor'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <MdOnlinePrediction size={24} />
                    </div>
                    Prediksi Faktor
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}

            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/riwayat-deteksi'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32"><path fill="white" d="M2 12v6h6v2H0v-8zm18 0v8h-8v-2h6v-6zM8 0v2H2v6H0V0zm12 0v8h-2V2h-6V0z" /><path fill="white" d="M16 24a4 4 0 1 1 0 8a4 4 0 0 1 0-8m12 0a4 4 0 1 1 0 8a4 4 0 0 1 0-8m-12 1.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5m12 0a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5M28 12a4 4 0 1 1 0 8a4 4 0 0 1 0-8m0 1.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5M10 6a4 4 0 1 1 0 8a4 4 0 0 1 0-8m0 1.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5" class="ouiIcon__fillSecondary" /></svg>
                    </div>
                    Riwayat Deteksi
                  </div>
                </div>
              </Link>
            ) : null}
            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/riwayat-deteksi'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32"><path fill="white" d="M2 12v6h6v2H0v-8zm18 0v8h-8v-2h6v-6zM8 0v2H2v6H0V0zm12 0v8h-2V2h-6V0z" /><path fill="white" d="M16 24a4 4 0 1 1 0 8a4 4 0 0 1 0-8m12 0a4 4 0 1 1 0 8a4 4 0 0 1 0-8m-12 1.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5m12 0a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5M28 12a4 4 0 1 1 0 8a4 4 0 0 1 0-8m0 1.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5M10 6a4 4 0 1 1 0 8a4 4 0 0 1 0-8m0 1.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5" class="ouiIcon__fillSecondary" /></svg>
                    </div>
                    Riwayat Deteksi
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}

            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/treatment'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" color="white"><path d="M8 7.839c0-2.092 1.896-4.16 3.226-5.353a1.91 1.91 0 0 1 2.548 0C15.104 3.68 17 5.746 17 7.84C17 9.89 15.296 12 12.5 12S8 9.89 8 7.839M4 14h2.395c.294 0 .584.066.847.194l2.042.988c.263.127.553.193.848.193h1.042c1.008 0 1.826.791 1.826 1.767c0 .04-.027.074-.066.085l-2.541.703a1.95 1.95 0 0 1-1.368-.124L6.842 16.75"/><path d="m13 16.5l4.593-1.411a1.985 1.985 0 0 1 2.204.753c.369.51.219 1.242-.319 1.552l-7.515 4.337a2 2 0 0 1-1.568.187L4 20.02"/></g></svg>
                    </div>
                    Treatment
                  </div>
                </div>
              </Link>
            ) : null}

            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/treatment'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" color="white"><path d="M8 7.839c0-2.092 1.896-4.16 3.226-5.353a1.91 1.91 0 0 1 2.548 0C15.104 3.68 17 5.746 17 7.84C17 9.89 15.296 12 12.5 12S8 9.89 8 7.839M4 14h2.395c.294 0 .584.066.847.194l2.042.988c.263.127.553.193.848.193h1.042c1.008 0 1.826.791 1.826 1.767c0 .04-.027.074-.066.085l-2.541.703a1.95 1.95 0 0 1-1.368-.124L6.842 16.75"/><path d="m13 16.5l4.593-1.411a1.985 1.985 0 0 1 2.204.753c.369.51.219 1.242-.319 1.552l-7.515 4.337a2 2 0 0 1-1.568.187L4 20.02"/></g></svg>
                    </div>
                    Treatment
                  </div>
                </div>
              </Link>
            ) : null}

            {/* --- */}

            {DocterPatient && currentUser.role == 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/rekomendasi'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-width="1.5"><path d="M3 3.6a.6.6 0 0 1 .6-.6h16.8a.6.6 0 0 1 .6.6v13.8a.6.6 0 0 1-.6.6h-4.14a.6.6 0 0 0-.438.189l-3.385 3.597a.6.6 0 0 1-.874 0l-3.385-3.597A.6.6 0 0 0 7.74 18H3.6a.6.6 0 0 1-.6-.6z"/><path stroke-linecap="round" stroke-linejoin="round" d="m12 7l1.425 2.575L16 11l-2.575 1.425L12 15l-1.425-2.575L8 11l2.575-1.425z"/></g></svg>
                    </div>
                    Rekomendasi
                  </div>
                </div>
              </Link>
            ) : null}

            {currentUser.role != 'doctor' ? (
              <Link className="py-2 px-4 duration-100 hover:bg-[#005A8F] text-sm" to='/rekomendasi'>
                <div>
                  <div role="button" tabindex="0" class="flex items-center w-full p-3 rounded-lg text-start leading-tight transition-all outline-none">
                    <div class="grid place-items-center mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-width="1.5"><path d="M3 3.6a.6.6 0 0 1 .6-.6h16.8a.6.6 0 0 1 .6.6v13.8a.6.6 0 0 1-.6.6h-4.14a.6.6 0 0 0-.438.189l-3.385 3.597a.6.6 0 0 1-.874 0l-3.385-3.597A.6.6 0 0 0 7.74 18H3.6a.6.6 0 0 1-.6-.6z"/><path stroke-linecap="round" stroke-linejoin="round" d="m12 7l1.425 2.575L16 11l-2.575 1.425L12 15l-1.425-2.575L8 11l2.575-1.425z"/></g></svg>
                    </div>
                    Rekomendasi
                  </div>
                </div>
              </Link>
            ) : null}
          </div>

          <h1 className='font-bold px-8 mt-[5vh] text-[18px] sm:text-xl flex flex-wrap'>
            <span className='blue'>Vidya</span>
            <span className='text-white'>Medic</span>
          </h1>
        </div>
      </div>

      {/* drawer of canvas for mobile device */}

    </>
  );
};

export default Side;
