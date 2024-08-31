import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';
import { IoMdCloseCircle } from "react-icons/io";
import { BsFillSendFill } from "react-icons/bs";
import { Link } from 'react-router-dom';

function RiskPrediction() {

  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [supporting_risks, setSupporting_risks] = useState(["Usia", "Operasi Jantung"]);
  const [detailPrediction, setDetailPrediction] = useState(null);
  const [detailAppointment, setDetailAppointment] = useState(null);
  const [statusAppointment, setStatusAppointment] = useState(null);
  const [idPrediction, setIdPrediction] = useState(null);

  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    fetchInit();
    console.log({ currentUser });
  }, []);

  const fetchInit = async () => {
    try {
      let url = '/api/predictionfactor/getinfo';
      if (currentUser.role != 'user') url += `?patient=${DocterPatient._id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      console.log({ data })
      setStatusAppointment(data.status);
      setDetailAppointment(data.appointment);
      if (!data.prediction) {
        setSupporting_risks([]);
        setDetailPrediction(null);
      } else {
        setDetailPrediction(data.prediction.result_prediction);
        setSupporting_risks(data.prediction.supporting_risks);
        setIdPrediction(data.prediction._id);
      }
    } catch (error) {
      console.log({ error });
    }
  }

  const handleRequestAppointmentUser = async () => {
    try {
      const res = await fetch(`/api/appointment/requestAppointment`, {
        headers: {
          'Content-Type': 'application/json',
        },
        method: "POST",
        body: JSON.stringify({
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Swal.fire('Yohoo!', data.message, 'success').then(() => window.location.reload());
    } catch (error) {
      console.log({ error });
      Swal.fire('Whoops!', error, 'error');
    }
  }

  const SubmitAppointment = async (e) => {
    e.preventDefault();
    let patient = currentUser._id;
    if (currentUser.role != 'user') patient = DocterPatient._id;

    try {
      const res = await fetch('/api/appointment/acceptAppointment', {
        headers: {
          'Content-Type': "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          date: e.target[0].value,
          time: e.target[1].value,
          note: e.target[2].value,
          patient
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      console.log({ data })
      setDetailAppointment(data.appointment);
      Swal.fire("Yohoo!", data.message, 'success');
      setStatusAppointment('accepted')
      setModal(false);
    } catch (error) {
      console.log({ error });
      Swal.fire("Whopps!", error, 'error');
    }
  }

  const handleEndedAppointment = async (e) => {
    try {
      const res = await fetch('/api/appointment/endedAppointment', {
        headers: {
          'Content-Type': "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          patient: DocterPatient._id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      Swal.fire("Nicee!", data.message, 'success');
      setDetailAppointment(null);
    } catch (error) {
      console.log({ error });
      Swal.fire("Whopps!", error, 'error');
    }
  }

  const ButtonActionUser = (state) => {
    const { status } = state;
    if (status == 'pending') return (<button disabled class="bg-orange-500 text-white active:bg-orange-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150 " type="button">Pending..</button>)
    else if (status == 'accepted') return (<button disabled class="bg-green-500 text-white active:bg-green-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150 " type="button">Accepted</button>
    )
    else return (<button onClick={handleRequestAppointmentUser} class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150 min-w-[150px]" type="button">{loading ? 'Loadingg..' : 'Meminta Temu Janji'}</button>)
  }

  const handleResetPrediction = async () => {
    let id = idPrediction;
    try {

      Swal.fire({
        title: "Are you sure?",
        text: "You will lose the prediction factor for this pasient",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then(async (result) => {
        if (result.isConfirmed) {

          const res = await fetch(`/api/predictionfactor/deleteinfo/${id}`, {
            headers: {
              "Content-Type": "application/json"
            },
            method: "DELETE"
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          Swal.fire({
            title: "Success",
            text: data.message,
            icon: "success",
            confirmButtonColor: "#3085d6",
          }).then(() => {
            window.location.reload();
          });

        }
      });



    } catch (error) {
      console.log({ error });
      Swal.fire("WhoopS!", error, 'error');
    }
  }

  return (
    <div>
      <main class="bg-white flex py-8">
        <Side />
        <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-24">
          <ButtonOffCanvas />
          <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
            <div class="rounded-t mb-0 px-4 py-3 border-0">
              <div class="flex flex-wrap items-center">
                <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                  <h3 class="font-semibold text-sm md:text-base text-blueGray-700">Prediksi Resiko</h3>
                </div>
                <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                  {currentUser.role == 'user' ? (
                    <div>

                      <ButtonActionUser status={statusAppointment} />

                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">

                      {detailPrediction ? (
                        <button onClick={() => handleResetPrediction(detailPrediction._id)} class="bg-red-500 text-white active:bg-red-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Reset Prediction</button>
                      ) : (
                        <Link to='/create/prediksi_factor' class="bg-green-500 text-white active:bg-green-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150 min-w-[150px]" type="button">Create Prediction</Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div class="block w-full overflow-x-auto">
              <table class="items-center bg-transparent w-full border-collapse ">
                <thead>
                  <tr>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Hasil Prediksi:
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs border-l-0 border-r-0 whitespace-nowrap font-semibold text-left italic">
                      {!detailPrediction ? '--empty' : 'Berpotensi memiliki penyakit jantung'}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      Faktor reskio dominan:
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      {supporting_risks.length > 0 ?
                        supporting_risks.map((val) => {
                          return (
                            <div>
                              - {val} <br />
                            </div>

                          )
                        }) : (
                          <div className="italic">
                            --empty
                          </div>
                        )}

                    </td>

                  </tr>

                </tbody>

              </table>
            </div>
          </div>

          {currentUser.role != 'user' && statusAppointment == 'pending' ? (
            <div className="flex ms-2 flex-col gap-2 font-semibold pt-4">
              <p>Pasient ini meminta temu janji dengan anda</p>
              <button onClick={() => setModal(true)} class="bg-indigo-500 w-fit text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150 min-w-[150px]" type="button">Buat Temu Janji</button>
            </div>
          ) : null}
          {/* Form submit Appointment */}

          {detailAppointment != null ? (
            <div class="flex w-full py-4 overflow-x-auto justify-between gap-4 mt-12 items-center">
              <div className="left">
                <h1 className='text-slate-900 font-bold text-[24px] mb-4'>Appointment</h1>
                {currentUser.role != 'user' ? (
                  <button onClick={handleEndedAppointment} class="bg-red-500 text-white active:bg-red-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Temu Janji Selesai</button>
                ) : null}
                <table class="max-w-[480px] bg-white shadow-md rounded-lg overflow-hidden">
                  <tbody>
                    <tr class="bg-white border-b">
                      <th class="px-6 py-4 whitespace-nowrap text-left text-[14px] font-semibold text-gray-900">
                        Detail Temu Janji
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">

                      </td>
                    </tr>
                    <tr class="bg-[#E2E3FF]/90 border-b">
                      <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                        Tanggal
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">
                        {/* January, 21 2024 */}
                        {new Intl.DateTimeFormat('id-ID', {
                          month: 'long',
                          day: '2-digit',
                          year: 'numeric'
                        }).format(new Date(detailAppointment.date))}
                      </td>
                    </tr>
                    <tr class="bg-white border-b">
                      <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                        Jam
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">
                        {new Intl.DateTimeFormat('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date().setHours(Number(detailAppointment.time.split(':')[0]), Number(detailAppointment.time.split(':')[1]))).replace('.', ' : ')}
                      </td>
                    </tr>
                    <tr class="bg-[#E2E3FF]/90 border-b">
                      <th class="px-6 py-4 whitespace-nowrap text-left text-sm font-medium text-gray-900">
                        Catatan dokter
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">
                        {detailAppointment.note}
                      </td>
                    </tr>

                  </tbody>
                </table>

              </div>

              <div className="rigth">

                <div className="bg-center bg-cover h-[30vh] hover:h-[40vh] duration-200 mb-4 rounded-md border" style={{ backgroundImage: `url('${detailAppointment.doctor.profilePicture}')` }}></div>
                <table class="max-w-[480px] border border-slate-800 lg:min-w-[400px] bg-white shadow-md rounded-lg overflow-hidden">
                  <tbody>
                    <tr class="bg-white border-b">
                      <th class="px-6 py-4 whitespace-nowrap text-left text-[14px] font-semibold text-gray-900">
                        Detail Docter
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">

                      </td>
                    </tr>

                    <tr class="bg-[#E2E3FF]/90 border-b">
                      <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                        Name
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">
                        {detailAppointment.doctor.name}
                      </td>
                    </tr>
                    <tr class="bg-white border-b">
                      <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                        No Handphone
                      </th>
                      <td class="px-6 py-4 text-sm text-gray-700">
                        {detailAppointment.doctor.phone_number}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

        </div>
      </main>

      {modal ? (
        <div className="w-full h-[100vh] flex justify-center items-center top-0 left-0 fixed z-20 bg-black/60">
          <div className="boxModal flex flex-col bg-white rounded-lg p-8 w-/10/12 lg:w-5/12">
            <div className="flex justify-end" onClick={() => setModal(!modal)}>
              <IoMdCloseCircle size={24} color='red' />
            </div>

            <h1 className='text-xl font-semibold mb-3'>Buat Jadwal Temu Janji</h1>
            <form action="" onSubmit={SubmitAppointment} method="post" className='flex flex-col gap-1'>
              <div className="flex justify-between">
                <div class="grid w-[48%] gap-6 mt-5 mb-5 sm:grid-cols-1">
                  <div class="relative z-0">
                    <input type="date" id="tanggal" name="tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal</label>
                  </div>
                </div>
                <div class="grid w-[48%] gap-6 mt-5 sm:grid-cols-1">
                  <div class="relative z-0">
                    <input type="time" id="awal" name="awal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Jam bertemu</label>
                  </div>
                </div>
              </div>
              <div class="grid gap-6 mt-4 mb-5 sm:grid-cols-1">
                <div class="relative z-0">
                  <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                  <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Catatan Untuk Pasien</label>
                </div>
              </div>

              <button type="submit" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 w-fit">
                <BsFillSendFill size={16} color='white' className='me-2' />
                Buat Temu Janji

              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}






export default RiskPrediction