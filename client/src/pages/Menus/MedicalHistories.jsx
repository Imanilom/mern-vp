import React, { useEffect, useState } from 'react'
import Side from '../../components/Side';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

import {
  setActionRiwayat, unsetActionRiwayat
} from '../../redux/user/webSlice';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';



function MedicalHistories() {

  const { currentUser, loading, error, DocterPatient } = useSelector((state) => state.user);
  const { Actionriwayatmedis } = useSelector(state => state.data);
  const [anemnesa, setAnemnesa] = useState([]);
  const [catatanTambahan, setCatatanTambahan] = useState([]);
  const [riwayat, setRiwayat] = useState(null);
  const dispacth = useDispatch();

  const handleDelete = async (id) => {
    console.log(id)
    Swal.fire({
      title: "Are you sure?",
      text: "Kamu tidak akan menemukan data ini lagi setelah dihapus.!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        const deleteAnamnesa = await fetch(`/api/anamnesa/deleteAnamnesa/${id}`, {
          method: 'DELETE'
        });

        Swal.fire({
          title: "Deleted!",
          text: "Anamnesa has been deleted.",
          icon: "success",
          confirmButtonColor: "#3085d6",
        }).then(async () => {
          await fetchData();
        })

      }
    });
  }

  let fetchData = async () => {
    try {
      let url;
      if (currentUser.role == 'user') {
        url = `/api/anamnesa/getanamnesa/${currentUser._id}`
      } else {
        url = `/api/anamnesa/getanamnesa/${DocterPatient._id}`
      }

      const res = await fetch(url);
      if (!res.ok) {
        setAnemnesa([]);
        setRiwayat([]);
      }
      const data = await res.json();
      console.log(data)
      setAnemnesa(data.details);
      setRiwayat(data.riwayatmedisDoc);
      setCatatanTambahan(data.tambahan)
      console.log(data.riwayatmedisDoc)
    } catch (error) {
      console.log(error)
    }
  }

  const handleResetRiwayat = async () => {
    try {
      Swal.fire({
        title: "Are you sure?",
        text: "Kamu akan kehilangan seluruh progress riwayat medismu beserta dengan catatan doktermu",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then(async (result) => {
        if (result.isConfirmed) {
          const deleteRiwayat = await fetch(`/api/anamnesa/deleteriwayat/${riwayat._id}`, {
            method: 'DELETE'
          });

          Swal.fire({
            title: "Deleted!",
            text: "Your Riwayat medis has been deleted.",
            icon: "success",
            confirmButtonColor: "#3085d6",
          }).then(async () => {
            await fetchData();
          });
        }
      });
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {

    AOS.init({
      duration: 700
    })
    fetchData();
    // console.log(currentUser);
  }, [])

  return (
    <main class="bgg-bl flex text-white">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-16">
        <ButtonOffCanvas />
       
        <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl text-white mb-4">Riwayat Medis</h1>
        <div data-aos="fade-right" className="flex gap-4">
          <div class="relative text-white flex flex-col min-w-0 break-words bg-[#363636]/20 w-full mb-6 shadow-lg rounded ">
            <div class="rounded-t mb-0 px-4 py-3 border-0">
              <div class="flex items-center">
                <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                  {/* <h3 class="font-semibold text-base text-blueGray-700">Riwayat Medis</h3> */}
                  <h3 class="font-semibold md:text-base text-blueGray-700 text-sm">Informasi medis anda</h3>
                </div>

                <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                  {currentUser.role != 'user' && riwayat != null ? (
                    <Link to={`/createAnamnesa/${riwayat._id}`} >
                      <button class="darkgreen text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none  min-w-[150px] md:min-w-[100px] mr-1 mb-1 ease-linear transition-all duration-150" type="button">Buat Anamnesa</button>
                    </Link>
                  ) : null}


                  {currentUser.role == 'user' && riwayat == null ? (
                    <Link to={`/input-medical`} onClick={() => dispacth(setActionRiwayat('create'))}>
                      <button class=" text-[#07AC7B] text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none  min-w-[150px] md:min-w-[100px] mr-1 mb-1 ease-linear transition-all duration-150" type="button">Isi Formulir</button>
                    </Link>
                  ) : null}

                  {currentUser.role == 'user' && riwayat != null ? (
                    // <Link to={`/input-medical`} onClick={() => dispacth(setActionRiwayat('create'))}>
                    <button onClick={handleResetRiwayat} class="bg-red-500 text-white active:bg-red-600 text-xs font-bold uppercase px-1 md:px-3 py-1 rounded min-w-[150px] md:min-w-[100px] outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Buat Ulang Riwayat</button>
                    // </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div class="block w-full bgg-bl overflow-x-auto ">
              <table class="items-center bg-[#363636]/20 w-full ">
                <thead>
                  <tr className='bg-[#2f2f2f]'>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Tanggal
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Dibuat Oleh
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Pertanyaan
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Jawaban
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {anemnesa && anemnesa.length > 0 ? (
                    anemnesa.map((val, _i) => {
                      return (
                        <tr className={_i % 2 != 0 ? `bg-[#2f2f2f]` : `bg-[#141414]`}>
                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                            {new Intl.DateTimeFormat('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            }).format(new Date())}
                          </td>
                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            {riwayat ? riwayat.Doctor.name : null}
                          </td>
                          <td class="border-t-0 break-words px-6 align-center border-l-0 border-r-0 text-xs p-4">
                            {val.pertanyaan}
                          </td>
                          <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                            {val.jawaban}
                            {/* Anamnesa */}
                          </td>
                        </tr>
                      )
                    })
                  ) : null}

                </tbody>

              </table>
            </div>
          </div>

          {anemnesa && anemnesa.length > 0 ? null : (

            <div className="flex flex-col gap-3 lg:w-4/12 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="-2 -3 24 24"><path fill="#d89c0d" d="m12.8 1.613l6.701 11.161c.963 1.603.49 3.712-1.057 4.71a3.2 3.2 0 0 1-1.743.516H3.298C1.477 18 0 16.47 0 14.581c0-.639.173-1.264.498-1.807L7.2 1.613C8.162.01 10.196-.481 11.743.517c.428.276.79.651 1.057 1.096M10 14a1 1 0 1 0 0-2a1 1 0 0 0 0 2m0-9a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1" /></svg>
              <p>
                System kami mendeteksi anda belum mencatat Riwayat Medis anda. berikan informasi lebih lanjut agar system kami lebih mengenal anda
              </p>
            </div>
          )}

        </div>

        {catatanTambahan && catatanTambahan.length > 0 ? (
          <div data-aos="fade-right" class="relative mt-8 flex flex-col min-w-0 break-words bgg-bl w-full mb-6 shadow-lg rounded ">
            <div class="rounded-t bg-[#363636]/30 mb-0 px-4 py-3 border-0">
              <div class="flex flex-wrap items-center">
                <div class="relative w-full px-4  max-w-full flex-grow flex-1">
                  {/* <h3 class="font-semibold text-base text-blueGray-700">Riwayat Medis</h3> */}
                  <h3 class="font-semibold text-base text-blueGray-700">Catatan Dokter anda</h3>
                </div>
              </div>
            </div>

            <div className="flex">
              <div class="block w-full overflow-x-auto">
                <table class="items-center bg-transparent w-full border-collapse ">
                  <thead>
                    <tr className='bg-[#2c2c2c]'>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Tanggal
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Dibuat Oleh
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Pertanyaan
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Jawaban
                      </th>

                      {currentUser.role != 'user' ? (
                        <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                          Action
                        </th>
                      ) : null}

                    </tr>
                  </thead>

                  <tbody>
                    {catatanTambahan && catatanTambahan.length > 0 ? (
                      catatanTambahan.map((val, _i) => {
                        return (
                          <tr className={_i % 2 == 0 ? 'bg-[#141414]' : 'bg-[#2c2c2c]'}>
                            <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                              {new Intl.DateTimeFormat('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              }).format(new Date())}
                            </td>
                            <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                              {riwayat ? riwayat.Doctor.name : null}
                            </td>
                            <td class="border-t-0 break-words px-6 align-center border-l-0 border-r-0 text-xs p-4">
                              {val.pertanyaan}
                            </td>
                            <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                              {val.jawaban}
                              {/* Anamnesa */}
                            </td>
                            {currentUser.role != 'user' ? (
                              <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 flex flex-col justify-end gap-1 text-white font-semibold">
                                <Link to={`/updateAnemnesa/${val._id}`} className='w-fit rounded-md px-3 py-1 darkgreen'>Edit</Link>
                                <button onClick={() => handleDelete(val._id)} className='w-fit bg-red-500 active:bg-red-600 rounded-md px-3 py-1'>Delete</button>
                              </td>
                            ) : null}

                          </tr>
                        )
                      })
                    ) : null}

                  </tbody>

                </table>
              </div>


            </div>
          </div>
        ) : null}


      </div>
    </main >

  )
}

export default MedicalHistories