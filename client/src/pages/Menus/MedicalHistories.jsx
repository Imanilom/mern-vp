import React, { useEffect, useState } from 'react'
import Side from '../../components/Side';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

import {
  setActionRiwayat, unsetActionRiwayat
} from '../../redux/user/webSlice';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';


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

    fetchData();
    // console.log(currentUser);
  }, [])

  return (
    <main class="bg-white flex">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-24">
        <ButtonOffCanvas />
        {catatanTambahan && catatanTambahan.length > 0 ? (
          <div class="relative mt-8 flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
            <div class="rounded-t mb-0 px-4 py-3 border-0">
              <div class="flex flex-wrap items-center">
                <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                  {/* <h3 class="font-semibold text-base text-blueGray-700">Riwayat Medis</h3> */}
                  <h3 class="font-semibold text-base text-blueGray-700">Catatan Docter lainnya</h3>
                </div>
              </div>
            </div>

            <div class="block w-full overflow-x-auto">
              <table class="items-center bg-transparent w-full border-collapse ">
                <thead>
                  <tr>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Tanggal
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Dibuat Oleh
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Pertanyaan
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Jawaban
                    </th>

                    {currentUser.role != 'user' ? (
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Action
                      </th>
                    ) : null}

                  </tr>
                </thead>

                <tbody>
                  {catatanTambahan && catatanTambahan.length > 0 ? (
                    catatanTambahan.map((val) => {
                      return (
                        <tr>
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
                              <Link to={`/updateAnemnesa/${val._id}`} className='w-fit rounded-md px-3 py-1 bg-yellow-400 active:bg-yellow-500'>Edit</Link>
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
        ) : null}


        <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t mb-0 px-4 py-3 border-0">
            <div class="flex items-center">
              <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                {/* <h3 class="font-semibold text-base text-blueGray-700">Riwayat Medis</h3> */}
                <h3 class="font-semibold md:text-base text-blueGray-700 text-sm">Riwayat Medis</h3>
              </div>

              <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                {currentUser.role != 'user' && riwayat != null ? (
                  <Link to={`/createAnamnesa/${riwayat._id}`} >
                    <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none  min-w-[150px] md:min-w-[100px] mr-1 mb-1 ease-linear transition-all duration-150" type="button">Buat Anamnesa</button>
                  </Link>
                ) : null}


                {currentUser.role == 'user' && riwayat == null ? (
                  <Link to={`/input-medical`} onClick={() => dispacth(setActionRiwayat('create'))}>
                    <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none  min-w-[150px] md:min-w-[100px] mr-1 mb-1 ease-linear transition-all duration-150" type="button">Jawab Pertanyaan</button>
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

          <div class="block w-full overflow-x-auto">
            <table class="items-center bg-transparent w-full border-collapse ">
              <thead>
                <tr>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Tanggal
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Dibuat Oleh
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Pertanyaan
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Jawaban
                  </th>

                </tr>
              </thead>

              <tbody>
                {anemnesa && anemnesa.length > 0 ? (
                  anemnesa.map((val) => {
                    return (
                      <tr>
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


      </div>
    </main >

  )
}

export default MedicalHistories