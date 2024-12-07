import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import Side from '../../components/Side'
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Swal from 'sweetalert2';
import { encryptStr, decryptHash } from '../../utls/encrypt.js'
import '../../loading.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas.jsx';
import DatePicker from 'react-datepicker';

import AOS from 'aos';


function Acitivity() {
  const [useractivitys, setUseractivitys] = useState([]);
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [aktivitas, setAktivitas] = useState(null);
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);
  const [logs, setLogs] = useState(null);
  const [timeGap, setTimeGap] = useState(null);

  const [isViewAct, setViewAct] = useState(true)
  const [isViewUnrelationAct, setViewUnrelationAct] = useState(true)

  const [paginationCount, setPaginationCount] = useState(0);
  const [paginationActive, setPaginationActive] = useState(1);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLog();
    }
  }, [startDate, endDate]);

  const fetchLogsNoRelation = async () => {
    try {
      setLoading(true)
      let url2 = `/api/user/testLogActivity`;
      if (timeGap) {
        url2 += `?gap=${timeGap}`;
      }

      const res2 = await fetch(url2);
      const data2 = await res2.json();

      console.log({ data2 })
      if (data2.result == null) {
        setLogs(null)
        return;
      }

      // desc
      const ordered = Object.keys(data2.result)
        .sort((a, b) => parseKey(b) - parseKey(a)) // Sortir berdasarkan objek Date
        .reduce((obj, key) => {
          obj[key] = data2.result[key];
          return obj;
        }, {});

      setLogs(ordered);
      console.log({ ordered })
    } catch (error) {
      console.log({error})
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchLogsNoRelation();
  }, [timeGap]);

  const handleactivityDelete = async (activityId) => {
    try {
      const res = await fetch(`/api/activity/delete/${activityId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      console.log(res)

      // get new data to make it reactive
      const res2 = await fetch(`/api/activity/getActivity`);
      const data2 = await res2.json();
      setAktivitas(data2);

      Swal.fire({
        title: "Success",
        text: "Your activities deleted",
        icon: "success",
        confirmButtonColor: "#3085d6",
      });


    } catch (error) {
      console.log(error.message);
    }
  };


  const confirmDelete = (activity) => {
    setActivityToDelete(activity);
    setShowModal(true);
  };

  const handleConfirmDelete = () => {
    handleactivityDelete(activityToDelete._id);
    setShowModal(false);
    setActivityToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowModal(false);
    setActivityToDelete(null);
  };

  const fetchLog = async () => {
    try {
      console.log('oke loading..')
      setLoading(true);
      let url = `/api/activity/getActivity?p=${paginationActive - 1}`;
      if (currentUser.role == 'doctor') {
        url = `/api/activity/getActivity/${DocterPatient._id}?p=${paginationActive - 1}`
      }

      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }

      // console.log(url);
      const res = await fetch(url);
      const data = await res.json();
      console.log({ data })
      if (data.success === false) {
        return;
      }
      console.log({ data });
      setAktivitas(data.Activity);
      setPaginationCount(data.totalPagination)

      await fetchLogsNoRelation();
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    AOS.init({
      duration : 700
    })
    fetchLog();
  }, []);

  useEffect(() => {
    // console.log({ pagination })
    fetchLog();
  }, [paginationActive])

  const parseTime = (timeString) => {
    const [hour, minute] = timeString.split(':').map(Number); // Memecah string dan mengonversi ke angka
    const now = new Date(); // Mengambil tanggal saat ini
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute); // Menggunakan tanggal saat ini
  };

  const parseKey = (key) => {
    const [datePart] = key.split('/');
    const [day, month, year] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day); // Buat objek Date
  };

  return (
    <main class="bg-[#101010] dark:bg-[#FEFCF5] flex dark:text-[#073B4C] text-white">
      <Side />

      <div class="xl:w-8/12 mb-12 xl:mb-0 px-4 mt-8 lg:mt-16 lg:w-screen w-11/12 mx-auto">
        {/* <ButtonOffCanvas index={3} /> */}
        
        {logs && isViewUnrelationAct ? (
          <div>
            {/* <h3 class="font-semibold text-[20px] text-blueGray-700 mb-3">
              Please Fill The Activity To See History Activity
            </h3> */}
            <div data-aos="fade-right" className="containers mt-5 font-semibold flex gap-3 mb-8">
              <div className="w-7/12">
                <table class="items-center w-full rounded-md">
                  <thead>
                    <tr className='bg-[#363636]/20 text-[#07AC7B] dark:bg-[#217170] dark:text-white'>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Tanggal
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Waktu Awal
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Waktu Akhir
                      </th>

                      {currentUser.role == 'user' ? (
                        <th class="px-6 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                          Action
                        </th>
                      ) : null}
                    </tr>
                  </thead>

                  <tbody>
                    {Object.keys(logs).map((timeSlot, _i) => {

                      if (_i < 5) {
                        return (
                          <tr className={_i % 2 == 0 ? 'bg-[#2c2c2c] dark:bg-[#E7E7E7]' : 'bg-[#141414] dark:bg-[#CBCBCB]'}>
                            <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                              {timeSlot.split('/')[0].replace('-', '/').replace('-', '/')}
                            </th>
                            <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                              {timeSlot.split('/')[1].split('-')[0]}
                            </td>
                            <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                              {timeSlot.split('/')[1].split('-')[1]}
                            </td>
                            <td class="text-[#07AC7B] dark:text-[#217170] font-semibold dark:underline border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                              <Link to={`/set/activity/${encryptStr(JSON.stringify({ date: timeSlot.split('/')[0], awal: timeSlot.split('/')[1].split('-')[0], akhir: timeSlot.split('/')[1].split('-')[1] }))}`}>
                                Set Activity
                              </Link>
                            </td>
                          </tr>
                        )
                      }
                    })}
                  </tbody>

                </table>
              </div>
              <div className="w-4/12 flex-col flex gap-3 font-normal">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="-2 -3 24 24"><path fill="#d89c0d" d="m12.8 1.613l6.701 11.161c.963 1.603.49 3.712-1.057 4.71a3.2 3.2 0 0 1-1.743.516H3.298C1.477 18 0 16.47 0 14.581c0-.639.173-1.264.498-1.807L7.2 1.613C8.162.01 10.196-.481 11.743.517c.428.276.79.651 1.057 1.096M10 14a1 1 0 1 0 0-2a1 1 0 0 0 0 2m0-9a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1" /></svg>
                <p>
                  System kami mendeteksi anda belum mencatat aktivitas. Catat sekarang dan pantau aktivitas harian Anda untuk membantu menjaga kesehatan secara optimal. Dengan mengisi informasi terkait aktivitas anda
                </p>

                <div className="flex gap-2 items-center">

                  <select
                    onChange={(e) => setTimeGap(e.target.value)}
                    id="yourSelect"
                    name="yourSelect"
                    className="block w-60 mt-2 p-3 rounded-md focus:outline-none shadow-lg bg-[#2C2C2C]/50 dark:bg-[#E7E7E7] "
                  >
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option selected value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                  {loading ? (
                    <span class="ms-4 loader"></span>
                  ) : null}
                </div>
              </div>
              {/* 
              {Object.keys(logs).map((timeSlot) => {
                console.log({ simestart: timeSlot.split('/')[1].split('-')[0], timeSlot })
                // console.log({ timeSlot }, timeSlot.split('/')[0], new Date(timeSlot.split('/')[0]))

                return (
                  <div className="box border text-xs md:text-[16px] items-center duration-300 hover:translate-x-4 flex flex-col gap-3 shadow-lg px-3 md:px-8 rounded-md py-3 max-w-60 w-fit">
                    <div className="flex  font-medium gap-4 md:gap-20">
                      <div className='min-w-20 gap-3 flex flex-col'>
                        <p>Tanggal</p>
                        <p className='text-gray-500'>{timeSlot.split('/')[0].replace('-', '/').replace('-', '/')}</p>
                      </div>
                      <div className='min-w-20 gap-3 flex flex-col'>
                        <p>Awal Waktu</p>
                        <p className='text-gray-500'>{timeSlot.split('/')[1].split('-')[0]}</p>
                      </div>
                      <div className='min-w-20 gap-3 flex flex-col'>
                        <p>Akhir Waktu</p>
                        <p className='text-gray-500'> {timeSlot.split('/')[1].split('-')[1]}</p>
                      </div>
                      <div className='min-w-20 gap-3 flex flex-col'>
                        <p>Action</p>
                        <Link to={`/set/activity/${encryptStr(JSON.stringify({ date: timeSlot.split('/')[0], awal: timeSlot.split('/')[1].split('-')[0], akhir: timeSlot.split('/')[1].split('-')[1] }))}`} className="w-fit px-1 md:px-3 py-1 md:py-2 cursor-pointer text-[12px] md:text-[16px] bg-[#46FF59]/90 hover:bg-[#46FF59] rounded-md">
                          Set Activity
                        </Link>

                      </div>
                    </div>


                  </div>
                )
              })} */}
            </div>
          </div>
        ) : null}

        {isViewAct ? (

          <>
            <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl mb-3 ">Aktivitas Pasien</h1>
         
              {/* <h4 className="text-lg font-semibold mb-2">Select Date Range</h4> */}
              <DatePicker
                selectsRange
                data-aos="fade-up"
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
                className="lg:p-3  p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded text-sm me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
              />
              {/* {loading ? (
                      <span class="ms-4 loader "></span>
                    ) : null} */}


            <div data-aos="fade-right" class="mt-4 relative flex flex-col min-w-0 break-words bg-[#363636]/20 dark:bg-[#217170] lg:w-10/12 mb-6 shadow-lg rounded ">
              <div class="rounded-md  mb-0 px-4 py-3 border-0">
                <div class="flex flex-wrap items-center">
                  <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                    <h3 class="font-semibold text-base text-blueGray-700 dark:text-white">{currentUser.role == 'user' ? "Aktivitas" : "Aktifitas Pasien"}</h3>
                  </div>
                  <div class="relative w-full px-4 max-w-full hidden md:block flex-grow flex-1 text-right">
                    {/* <Link to={'/createActivity'}>
                  <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">
                    Tambahkan aktivitas
                  </button>
                </Link> */}
                  </div>
                </div>
              </div>

              <div class="block overflow-x-auto">
                <table class="items-center bg-[#2c2c2c] dark:bg-[#E7E7E7] w-full  ">
                  <thead>
                    <tr className='bg-[#2c2c2c] dark:bg-[#E7E7E7]'>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Tanggal
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Awal
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Akhir
                      </th>
                      <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                        Aktivitas
                      </th>
                      {currentUser.role == 'user' ? (
                        <th class="px-6 text-blueGray-500 text-end align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold ">
                          Aksi
                        </th>
                      ) : null}
                    </tr>
                  </thead>

                  <tbody>
                    {aktivitas?.map((aktivitas, _i) => (
                      <tr key={aktivitas._id} className={_i % 2 == 0 ? 'bg-[#141414] dark:bg-[#CBCBCB]' : 'bg-[#2c2c2c] dark:bg-[#E7E7E7]'}>
                        <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                          {new Date(aktivitas.Date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </th>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {new Intl.DateTimeFormat('id-ID', {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(parseTime(aktivitas.awal)).toString().replace('.', ':')}
                        </td>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {new Intl.DateTimeFormat('id-ID', {
                            hour: "2-digit",
                            minute: "2-digit"
                          }).format(parseTime(aktivitas.akhir)).toString().replace('.', ':')}
                        </td>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {aktivitas.aktivitas}
                        </td>
                        {currentUser.role == 'user' ? (
                          <td>
                            <div class="relative w-full px-4 max-w-full flex-grow flex-1 py-2 sm:py-0 text-right">
                              <Link to={`/updateActivity/${aktivitas._id}`}>
                                <button class="text-[#07AC7B] dark:text-[#217170] text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Update</button>
                              </Link>

                              <button class="text-red-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={() => confirmDelete(aktivitas)}>Delete</button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>


              </div>


            </div>
          </>
        ) : null}

        {paginationCount >= 1 ? (
          <div className="flex items-center gap-8 mb-8">
          <div data-aos="fade-right" className="pagination flex gap-2 text-sm overflow-x-auto max-w-sm">
            {Array.from({ length: paginationCount }).map((_, _i) => (
              _i + 1 === paginationActive ? (
                <div className="py-3 px-7 bg-[#005A8F] dark:bg-[#DDA420] text-white rounded-[5px]">
                  {_i + 1}
                </div>
              ) : (
                <div onClick={() => { setPaginationActive(_i + 1); }} className="py-3 px-4 bg-[#272727] dark:bg-[#217170] text-white rounded-[5px]">
                  {_i + 1}
                </div>
              )))
            }

          </div>
            <p className="font-semibold text-[#07AC7B] dark:text-[#217170] text-sm">/ Pagination bisa di scrool</p>
          </div>

        ) : null}

        {loading ? (
          <div className='h-[60vh] flex items-center justify-center'>
            <span class="ms-4 loader"></span>
          </div>
        ) : null}
      </div>
      {
        showModal && (
          <div class="fixed bg-black/80 inset-0 flex items-center justify-center z-50">
            <div class="bgg-bl p-6 rounded shadow-lg max-w-[350px] md:max-w-[500px]">
              <h2 class="text-lg font-semibold mb-4">Konfirmasi Hapus</h2>
              <p>Apakah Anda yakin ingin menghapus aktivitas ini?</p>
              <p><strong>Tanggal:</strong> {new Date(activityToDelete.Date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(activityToDelete.Date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p><strong>Awal:</strong> {activityToDelete.awal}</p>
              <p><strong>Akhir:</strong> {activityToDelete.akhir}</p>
              <p><strong>Aktivitas:</strong> {activityToDelete.aktivitas}</p>
              <div class="mt-4 flex justify-end">
                <button class=" text-white px-4 py-2 rounded mr-2" onClick={handleCancelDelete}>Cancel</button>
                <button class="bg-red-600 text-white font-medium px-4 py-2 rounded" onClick={handleConfirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        )
      }


      {/* {Object.keys(logs).map((timeSlot) => (
        <div key={timeSlot} id={timeSlot}>
          <h2>{timeSlot}</h2>
          
          {logs[timeSlot].map((data, index) => (
            <div key={index}>
              <p id={data.create_at}>Data {index + 1}:</p>
             
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </div>
          ))}
        </div>
      ))} */}
    </main >

  )
}

export default Acitivity