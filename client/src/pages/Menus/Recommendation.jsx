import React, { useEffect, useState } from 'react'

import Side from '../../components/Side';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AOS from 'aos';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';

function Recommendation() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);

  const [recomendation, setRecomendation] = useState([]);
  const [isCheckAction, setCheckAction] = useState(false);
  // const [id, setId] = useState(null);
  const [isModal, setModal] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pagination, setPagination] = useState(0);
  const [currentPagination, setCurrentPagination] = useState(1);

  // Fungsi untuk mengisi checkbox aktivitas (untuk pasien)
  const checkboxAction = async (e, properti) => {
    if (isCheckAction) {
      // user gabisa langsung ceklis banyak.. harus antri
      e.target.checked = false; // set checkbox jadi false
      alert('Please wait. dont spam.'); // kasi peringatan
    }
    else {
      setCheckAction(true); // set ke true, agar memblokir spam
      try {

        const formData = JSON.stringify({
          activity_id: properti.id, // kirim id rekomendasi
        });

        let res;

        if (properti.checked) {
          // do action to unchecklist
          res = await fetch('/api/action/recomendation/uncheck', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: formData // kirim properti
          })

        } else {
          // do action to checklist
          res = await fetch('/api/action/recomendation/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: formData // kirim properti
          })

          const data = await res.json();

          // Tampilkan popup bahwa telah berhasil
          Swal.fire({
            title: "Success",
            text: "Berhasil assign aktivitas",
            icon: "success",
            confirmButtonColor: "#3085d6",
          });
        }

      } catch (error) {
        console.log(error);
      } finally {
        setCheckAction(false); // set ke false, agar pasien bisa checklist chexbox kembali
      }
    }
  }

  // Fungsi untuk mendelete rekomendasi aktivitas (dokter only)
  const handleDelete = async (id) => {
    try {

      // Confrim delete
      Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then(async (result) => {

        // Jika di confirmasi 
        if (result.isConfirmed) {
          const res = await fetch(`/api/recomendation/delete/${id}/${DocterPatient._id}`, {
            method: 'Delete'
          });

          const data = await res.json();
          setRecomendation(data.recomendations); // timpa data informasi rekomendasi aktivitas terbaru

          // Tampilkan popup success
          Swal.fire({
            title: "Success",
            text: data.message,
            icon: "success",
            confirmButtonColor: "#3085d6",
          });

        }
      });

    } catch (error) {
      console.log(error);
    }
  }

  // FUngsi ketika ada perubahan pada currentPagination
  const handleChangePagination = (num) => {
    if (num > 0 && num < pagination + 1) {
      setCurrentPagination(num);
    }
  }

  useEffect(() => {
    // Panggil AOS untuk animation on scrool
    AOS.init({
      duration: 700
    })
    fetchtdata(); // run function
  }, [])

  // Fungsi untuk mendapatkan informasi rekomendasi aktivitas
  const fetchtdata = async () => {
    try {

      let url;

      if (currentUser.role != 'user') {
        url = `/api/recomendation/getAll/${DocterPatient._id}?p=${currentPagination - 1}`;

        // Jika ada date time range
        if (startDate && endDate) {
          url = `/api/recomendation/getAll/${DocterPatient._id}?p=${currentPagination - 1}&startDate=${startDate}&endDate=${endDate}`;
        }
      } else {

        url = `/api/recomendation/getAll/${currentUser._id}?p=${currentPagination - 1}`;
        
        // Jika ada date time range
        if (startDate && endDate) {
          url = `/api/recomendation/getAll/${currentUser._id}?p=${currentPagination - 1}&startDate=${startDate}&endDate=${endDate}`;
        }
      }

      const res = await fetch(url);
      const data = await res.json();

      // Simpan informasi dari response ke dalam variabel
      setRecomendation(data.recomendation);
      setPagination(data.lengthPagination);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    fetchtdata(); // run function
  }, [currentPagination]);

  // Ketika ada perubahan value pada date range
  useEffect(() => {
    if (startDate && endDate) {
      fetchtdata(); // run function
    }
  }, [startDate, endDate]);

  return (
    <main class="bg-[#101010] dark:bg-[#FEFCF5] flex dark:text-[#073B4C] text-white">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-16">
        {/* <ButtonOffCanvas /> */}

        <h1 data-aos="fade-up" class="text-lg md:text-3xl font-semibold capitalize lg:text-4xl md:mb-4">Rekomendasi aktivitas</h1>

        <DatePicker
          data-aos="fade-up"
          selectsRange
          startDate={startDate}
          endDate={endDate}
          onChange={(dates) => {
            const [start, end] = dates;
            console.log(start, end)
            setStartDate(start);
            setEndDate(end);
          }}
          isClearable
          placeholderText='Cari berdasarkan range tanggal'
          className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded text-sm sm:me-0 me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
        />

        <div data-aos="fade-right" class="md:mt-4 mt-0 relative flex flex-col min-w-0 break-words bg-[#363636]/20 w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t bg-[#363636]/20 dark:bg-[#217170] mb-0 px-4 py-3 border-0">
            <div class="flex  flex-wrap flex-col sm:flex-row sm:items-center items-start sm:gap-0 gap-1">
              <div class="relative w-full md:px-4 max-w-full flex-grow flex-1">
                <h3 class="font-semibold text-sm md:text-base text-blueGray-700 dark:text-white">Rekomendasi</h3>
              </div>
              <div class="relative w-full md:px-4 max-w-full flex-grow flex-1 md:text-right">
                {currentUser.role !== 'user' ? (
                  <Link to="/createRecomendation">
                    <button class="text-[#07AC7B] dark:text-[#FFD166] text-xs w-full md:w-fit text-end font-bold uppercase md:px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Buat rekomendasi aktivitas</button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div class="block w-full overflow-x-auto" data-aos="fade-right">
            <table class="items-center bg-transparent w-full  ">
              <thead>
                <tr className='bg-[#2f2f2f] dark:bg-[#E7E7E7]'>
                  {currentUser.role == 'user' ? (
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Doctor
                    </th>
                  ) : null}
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Berlaku dari
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Hingga tanggal
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Aktivitas
                  </th>

                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Status
                  </th>
                  {currentUser.role != 'user' ? (
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Action
                    </th>

                  ) : null}

                </tr>
              </thead>

              <tbody>
                {recomendation.length > 0 ? (
                  recomendation.map((recomendation, i) => {
                    return (
                      <tr className={i % 2 == 0 ? 'bg-[#141414] dark:bg-[#CBCBCB]' : 'bg-[#2f2f2f] dark:bg-[#E7E7E7]'}>
                        {currentUser.role == 'user' ? (
                          <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                            {recomendation.doctor.name}
                          </th>
                        ) : null}
                        <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                          {new Intl.DateTimeFormat('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          }).format(new Date(recomendation.berlaku_dari))}
                        </th>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {new Intl.DateTimeFormat('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          }).format(new Date(recomendation.hingga_tanggal))}
                        </td>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {recomendation.name}

                        </td>
                        {currentUser.role != 'user' ? (
                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            {recomendation.status ? (
                              <span className="w-fit px-3 py-1 bg-green-500 dark:bg-[#217170] text-white rounded-full">Done</span>
                            ) : (
                              <span className="w-fit px-3 py-1 bg-slate-800 text-white rounded-full">Noy yet</span>

                            )}
                          </td>
                        ) : null}


                        {currentUser.role == 'user' ? (
                          <td class="border-t-0 px-6 flex gap-2 items-center align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            {recomendation.status ? (
                              <>
                                <input
                                  type="checkbox"
                                  checked
                                  onChange={() => checkboxAction(event, { id: recomendation._id, checked: true })}
                                  className="form-checkbox h-5 w-5 text-indigo-600 bg-[#2f2f2f] checked:accent-[#07AC7B] dark:checked:accent-[#FFD166]"
                                /> Selesai
                              </>
                            ) : (
                              <>
                                <input
                                  type="checkbox"
                                  onChange={() => checkboxAction(event, { id: recomendation._id, checked: false })}
                                  className="form-checkbox h-5 w-5 text-indigo-600 bg-[#2f2f2f] checked:accent-[#07AC7B] dark:checked:accent-[#FFD166]"
                                />
                              </>
                            )}

                          </td>
                        ) : (
                          <td class="border-t-0 px-6 flex gap-2 items-center align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">

                            <Link to={`/updateRecomendation/${recomendation._id}`}>
                              <span className='text-[#07AC7B] dark:text-[#D39504] font-medium py-1 px-3 rounded-md '>Edit</span>
                            </Link>
                            <button onClick={() => handleDelete(recomendation._id)} data-modal-target="popup-modal" data-modal-toggle="popup-modal">
                              <span className='bg-red-600 font-medium py-1 px-3 rounded-md active:bg-red-600/80 text-white'>Delete</span>
                            </button>
                            {/* <button onClick={() => { setId(recomendation._id); setModal(true) }} data-modal-target="popup-modal" data-modal-toggle="popup-modal">
                              <span className='bg-red-600 font-medium py-1 px-3 rounded-md active:bg-red-600/80 text-white'>Delete</span>
                            </button> */}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <nav data-aos="fade-right" aria-label="Page navigation example" className='pb-5 max-w-[400px]' style={{ overflowX: 'auto' }}>
          <div className="pagination flex gap-2 mb-8 text-sm">
            {Array.from({ length: pagination }).map((_i, i) => {

              if (i + 1 == currentPagination) {
                return (
                  <div className="py-3 px-7 bg-[#005A8F] dark:bg-[#FFD166] text-white rounded-[5px]">
                    {i + 1}
                  </div>
                )
              } else {
                return (
                  <div onClick={() => { handleChangePagination(i + 1); }} className="py-3 px-4 rounded-[5px] bg-[#272727] dark:bg-[#073B4C] text-white cursor-pointer">
                    {i + 1}
                  </div>

                )
              }
            })}
          </div>
        </nav>
      </div>

      {/* modal
      {isModal ? (
        <div class="overflow-y-auto flex overflow-x-hidden bg-black/20 fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full">
          <div class="relative p-4 w-full max-w-md max-h-full">
            <div class="relative bg-white rounded-lg p-4 shadow dark:bg-gray-700">
              <button onClick={() => setModal(!isModal)} type="button" class="absolute top-3 end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white" data-modal-hide="popup-modal">
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                </svg>
                <span class="sr-only">Close modal</span>
              </button>
              <div class="p-4 md:p-5 text-center">
                <svg class="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 11V6m0 8h.01M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">Are you sure you want to delete this rekomendasi aktivitas?</h3>
                <button onClick={() => handleDelete()} data-modal-hide="popup-modal" type="button" class="text-white bg-red-600 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 dark:focus:ring-red-800 font-medium rounded-lg text-sm inline-flex items-center px-5 py-2.5 text-center">
                  Yes, I'm sure
                </button>
                <button data-modal-hide="popup-modal" onClick={() => setModal(!isModal)} type="button" class="py-2.5 px-5 ms-3 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">No, cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null} */}
    </main>
  );
}

export default Recommendation;