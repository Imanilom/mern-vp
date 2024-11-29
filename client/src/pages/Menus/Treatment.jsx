import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';

function Treatment() {
  const { currentUser, DocterPatient } = useSelector(state => state.user);
  const [history, setHistory] = useState([]);
  const [treatment, setTreatment] = useState(null);
  const [showInfoDokter, setShowInfo] = useState(false);
  const [pagination, setPagination] = useState(0);
  const [currentPagination, setCurrentPagination] = useState(1);

  useEffect(() => {
    fetchInit();
    AOS.init({
      duration: 500
    })
  }, [])

  useEffect(() => {
    fetchInit();
  }, [currentPagination])

  const handleChangePagination = (num) => {
    if (num > 0 && num < pagination + 1) {
      setCurrentPagination(num);
    }
  }

  const fetchInit = async () => {
    try {
      let url = '/api/treatment/getTreatment';
      if (currentUser.role == 'user') {
        url += `/${currentUser._id}`
      } else {
        url += `/${DocterPatient._id}`
      }
      url += `?p=${currentPagination - 1}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        console.log({ data, res })
        throw new Error(data.message)
      }

      setTreatment(data.treat);
      setHistory(data.history);
      setPagination(data.lengthPagination);
      console.log('oke')
    } catch (error) {
      console.log({ error });
    }
  }

  const handleDelete = async (id, i) => {
    try {
      Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then(async (result) => {
        if (result.isConfirmed) {

          const res = await fetch(`/api/treatment/${id}`, {
            method: "DELETE"
          });

          const data = await res.json();
          Swal.fire({
            title: "Deleted!",
            text: "Treatment succesfully deleted.",
            icon: "success"
          });

          const changedHistory = history.filter((_, index) => index != i);
          setHistory(changedHistory);
        }
      });
    } catch (err) {
      console.log({ err });
    }

  }

  const handleSwitchSubmit = async () => {
    try {

      const res = await fetch('/api/treatment/switchTreatment', {
        body: JSON.stringify({
          _id: treatment._id
        }),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      Swal.fire('Yohhoo!', data.message, 'success').then(() => window.location.reload());
    } catch (error) {
      console.log({ error });
      Swal.fire('Whoops', error.message, 'error');
    }
  }

  return (
    <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex">
      <Side />
      <div class="w-full xl:w-9/12 mb-12 xl:mb-0 px-4 mx-auto md:mt-0 mt-4 sm:mt-16">
        {/* <ButtonOffCanvas /> */}

        {treatment ? (
          <div class="flex w-full py-4 overflow-x-auto justify-between gap-8 md:mt-12 items-center flex-col sm:flex-row">
            <div data-aos="fade-right" className="left lg:min-w-[480px]" >
              <h1 class="text-2xl font-semibold capitalize md:text-4xl md:mb-3" >Treatment</h1>
              <h1 class="text-sm md:text-[16px] font-semibold mb-3">Pengobatan anda saat ini</h1>

              {currentUser.role == 'user' ? (
                <div className="flex gap-2 items-center justify-end mb-3 ">
                  {/* <h1 className='text-slate-900 font-bold text-[20px]'>Treatment Pasien</h1> */}
                  <button type='button' className="w-fit px-3 py-1 bg-orange-500 hover:bg-orange-500/90 text-[12px] font-medium text-white rounded-md">Ongoing</button>
                </div>
              ) : (
                <div className="flex gap-2 md:items-center md:justify-end mb-3 ">
                  {/* <h1 className='text-slate-900 font-bold text-[20px]'>Treatment Pasien</h1> */}
                  <div className="flex w-full md:w-fit flex-col md:flex-row md:justify-between gap-1">
                    <button onClick={() => handleSwitchSubmit()} type='button' className="w-full md:w-fit px-3 py-2 md:py-1 text-[12px] font-semibold text-white md:text-[#101010] bg-[#07AC7B] dark:bg-[#FFD166] rounded-md">Tandai treatment telah usai</button>
                    <Link to={`/treatment/update/${treatment._id}`} className="w-full md:w-fit px-3 py-2 md:py-1 text-xs font-medium bg-orange-500 text-white text-center md:text-start rounded-md">Update</Link>
                  </div>

                </div>
              )}



              <table class="max-w-[480px] indi overflow-hidden">
                <tbody>
                  <tr class="bg-[#363636]/20 dark:bg-[#217170] text-white">
                    <th class="px-6 py-4 whitespace-nowrap text-left text-[14px] font-semibold ">
                      Detail Treatment
                    </th>
                    <td class="px-6 py-4 text-sm ">

                    </td>
                  </tr>
                  <tr class="bg-[#2f2f2f] dark:bg-[#E7E7E7]">
                    <th class="px-6 py-4 text-left text-sm font-medium ">
                      Tanggal
                    </th>
                    <td class="px-6 py-4 text-sm ">
                      {/* January, 21 2024 */}
                      {new Intl.DateTimeFormat('id-ID', {
                        month: 'long',
                        day: '2-digit',
                        year: 'numeric'
                      }).format(new Date(treatment.createdAt))}
                    </td>
                  </tr>
                  <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                    <th class="px-6 py-4 text-left text-sm font-medium ">
                      Diagnosa
                    </th>
                    <td class="px-6 py-4 text-sm ">
                      {treatment.diagnosis}
                    </td>
                  </tr>
                  <tr class="bg-[#2f2f2f] dark:bg-[#E7E7E7]">
                    <th class="px-6 py-4 text-left text-sm font-medium ">
                      Tanggal Checkup ulang
                    </th>
                    <td class="px-6 py-4 text-sm ">
                      {/* January, 21 2024 */}
                      {treatment.followUpDate ? (
                        new Intl.DateTimeFormat('id-ID', {
                          month: 'long',
                          day: '2-digit',
                          year: 'numeric'
                        }).format(new Date(treatment.followUpDate))
                      ) : '- dokter tidak meminta anda untuk checkup ulang'}
                    </td>
                  </tr>
                  <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                    <th class="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                      Catatan dokter
                    </th>
                    <td class="px-6 py-4 text-sm ">
                      {treatment.notes != '' ? treatment.notes : '- Tidak ada catatan dari dokter'}
                    </td>
                  </tr>

                </tbody>
              </table>

              <div className="flex text-sm justify-between bg-[#363636]/20 dark:bg-[#207170] text-white rounded-md my-3 px-6 py-3">
                <p>Informasi pribadi dokter anda</p>
                <p className='text-[#07AC7B] dark:text-[#FFD166] font-semibold cursor-pointer' onClick={() => setShowInfo(!showInfoDokter)}>
                  {showInfoDokter ? 'Hide' : 'Show'}
                </p>
              </div>

              {showInfoDokter ? (

                <div className="my-3 bg-center group relative bg-cover h-[35vh] hover:h-[45vh] duration-500 mb-4 rounded-md " style={{ backgroundImage: `url('${treatment.doctor.profilePicture}')` }}>
                  <div className="bg-black/80 group-hover:bg-black/60 absolute left-0 top-0 w-full h-full rounded-md"></div>
                </div>
              ) : null}

            </div>


            <div data-aos="fade-up" className="rigth w-full">
              <h1 class="text-xl font-semibold capitalize lg:text-2xl mb-3">List Obat Pasien </h1>
             

              <div className="flex flex-col my-3 gap-3">
                {treatment.medications.length > 0 ? (
                  treatment.medications.map((medision) => {
                    return (
                      <div className="py-5 w-full md:w-[90%] hover:w-full px-4 rounded-md bg-[#00C34E]/80 duration-150 md:bg-[#363636]/20 text-sm flex flex-col gap-3 hover:bg-[#00C34E]/80 dark:hover:bg-[#217170] dark:hover:text-white">
                        <p className='text-[18px]'>{medision.name}</p>
                        <p className=''>Dosis Obat :  {medision.dosage}</p>
                        <p className=''>Frequency :  {medision.frequency}</p>
                      </div>
                    )
                  })
                ) : null}

                {/* <card className="py-5 px-4 rounded-md w-[90%] hover:w-full duration-150 bg-[#363636]/20 text-sm flex flex-col gap-3 hover:bg-[#00C34E]/80">
                  <p className='text-[18px]'>Bodrexin AE</p>
                  <p className=''>Dosis Obat : 1 Sendok Makan</p>
                  <p className=''>Frequency : 3 x sehari</p>
                </card>
                <card className="py-5 px-4 rounded-md w-[90%] hover:w-full duration-150 bg-[#363636]/20 text-sm flex flex-col gap-3 hover:bg-[#00C34E]/80">
                  <p className='text-[18px]'>Bodrexin AE</p>
                  <p className=''>Dosis Obat : 1 Sendok Makan</p>
                  <p className=''>Frequency : 3 x sehari</p>
                </card> */}
              </div>

              {showInfoDokter ? (
                <table class="my-3 sm:max-w-[480px] border border-slate-800 lg:min-w-[480px] shadow-md rounded-lg overflow-hidden">
                  <tbody>
                    <tr class="bg-[#363636]/20 dark:bg-[#217170] text-white">
                      <th class="px-6 py-4 whitespace-nowrap text-left text-[14px] font-semibold ">
                        Ditulis oleh:
                      </th>
                      <td class="px-6 py-4 text-sm ">

                      </td>
                    </tr>

                    <tr class="bg-[#2f2f2f] dark:bg-[#E7E7E7]">
                      <th class="px-6 py-4 text-left text-sm font-medium ">
                        Name
                      </th>
                      <td class="px-6 py-4 text-sm ">
                        {treatment.doctor.name}
                      </td>
                    </tr>
                    <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                      <th class="px-6 py-4 text-left text-sm font-medium ">
                        No Handphone
                      </th>
                      <td class="px-6 py-4 text-sm ">
                        {treatment.doctor.phone_number}
                      </td>
                    </tr>
                  </tbody>
                </table>

              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex md:flex-row flex-col justify-between md:items-end">
          <div data-aos="fade-up">
            <h1 class="text-2xl md:text-3xl font-semibold capitalize lg:text-4xl mb-1 ">Treatment Pasien</h1>
            <h1 class="text-sm md:text-md  mb-4 ">Histori treatment pasien yang pernah dijalani.</h1>
          </div>
          {currentUser.role != 'user' && treatment == null ? (
            <Link to={`/treatment/create`} className="darkgreen uppercase text-sm pb-3 font-semibold">Create Treatment</Link>
          ) : null}
        </div>

        <div data-aos="fade-right" class="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded ">
          <div class="block w-full bgg-bl overflow-x-auto rounded">
            <table class="items-center w-full  ">
              <thead>
                <tr className="bg-[#2f2f2f] dark:bg-[#217170] text-[#07AC7B] dark:text-white">
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-4 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Tanggal
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Diagnosa
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Dokter
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Status
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {history.length > 0 ? (
                  history.map((val, i) => (
                    <tr className={i % 2 == 0 ? 'bg-[#141414]' : 'bg-[#2f2f2f]'}>
                      <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                        {new Intl.DateTimeFormat('ID-id', {
                          month: 'long',
                          day: '2-digit',
                          year: '2-digit'
                        }).format(new Date(val.treatmentDate))}
                      </th>
                      <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                        {val.diagnosis}
                      </td>
                      <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                        {val.doctor.name}
                      </td>
                      <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                        <div className="w-fit font-semibold px-3 py-1 bg-green-500 text-white rounded-md">Selesai</div>
                      </td>
                      <td class="border-t-0 font-semibold px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                        <div className="flex flex-wrap gap-1">
                          {currentUser.role != 'user' ? (
                            <button onClick={() => handleDelete(val._id, i)} className="w-fit px-3 py-1 bg-red-600 text-white rounded-md">Delete</button>
                          ) : '- nothing'}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : null}

              </tbody>
            </table>
          </div>
        </div>

        {/* pagination */}
        <nav data-aos="fade-right" aria-label="Page navigation example" className='pb-5 max-w-[400px]' style={{ overflowX: 'auto' }}>
          <div className="pagination flex gap-2 mb-8 text-sm">
            {Array.from({ length: pagination }).map((_i, i) => {

              if (i + 1 == currentPagination) {
                return (
                  <div className="py-3 px-7 bgg-b text-white rounded-[5px]">
                    {i + 1}
                  </div>
                )
              } else {
                return (
                  <div onClick={() => { handleChangePagination(i + 1); }} className=" rounded-[5px] py-3 px-4 bg-[#272727] text-white cursor-pointer">
                    {i + 1}
                  </div>

                )
              }
            })}


          </div>
        </nav>
      </div>
    </main>

  )
}

export default Treatment