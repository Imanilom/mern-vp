import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
function Treatment() {
  const { currentUser, DocterPatient } = useSelector(state => state.user);
  const [history, setHistory] = useState([]);
  const [treatment, setTreatment] = useState(null);

  useEffect(() => {
    fetchInit();
  }, [])

  const fetchInit = async () => {
    try {
      let url = '/api/treatment/getTreatment';
      if (currentUser.role == 'user') {
        url += `/${currentUser._id}`
      } else {
        url += `/${DocterPatient._id}`
      }
      const res = await fetch(url);
      const data = await res.json();

      setTreatment(data.treat);
      setHistory(data.history);
      console.log({ data })
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
    <main class="bg-white flex">
      <Side />
      <div class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-12 sm:mt-24">
        <ButtonOffCanvas />
        {treatment ? (
          <div class="flex w-full py-4 overflow-x-auto justify-between gap-4 mt-12 items-center flex-col sm:flex-row">
            <div className="left">
              {currentUser.role == 'user' ? (
                <div className="flex gap-2 items-center justify-between ">
                  <h1 className='text-slate-900 font-bold text-[20px]'>Treatment Pasien</h1>
                  <button type='button' className="w-fit px-3 py-1 bg-orange-500 hover:bg-orange-500/90 text-[12px] font-medium text-white rounded-md">Ongoing</button>
                </div>
              ) : (
                <div className="flex gap-2 items-center justify-between ">
                  <h1 className='text-slate-900 font-bold text-[20px]'>Treatment Pasien</h1>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => handleSwitchSubmit()} type='button' className="w-fit px-3 py-1 bg-blue-500 hover:bg-blue-500/90 text-[12px] font-medium text-white rounded-md">Tandai treatment telah usai</button>
                    <Link to={`/treatment/update/${treatment._id}`} className="w-fit px-3 py-1 text-xs font-medium bg-orange-500 text-white rounded-md">Update</Link>
                  </div>

                </div>
              )}



              <table class="max-w-[480px] bg-white shadow-md rounded-lg overflow-hidden">
                <tbody>
                  <tr class="bg-white border-b">
                    <th class="px-6 py-4 whitespace-nowrap text-left text-[14px] font-semibold text-gray-900">
                      Detail Treatment
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
                      }).format(new Date(treatment.createdAt))}
                    </td>
                  </tr>
                  <tr class="bg-white border-b">
                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                      Diagnosa
                    </th>
                    <td class="px-6 py-4 text-sm text-gray-700">
                      {treatment.diagnosis}
                    </td>
                  </tr>
                  <tr class="bg-[#E2E3FF]/90 border-b">
                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                      Tanggal Checkup ulang
                    </th>
                    <td class="px-6 py-4 text-sm text-gray-700">
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
                  <tr class="bg-white border-b">
                    <th class="px-6 py-4 whitespace-nowrap text-left text-sm font-medium text-gray-900">
                      Catatan dokter
                    </th>
                    <td class="px-6 py-4 text-sm text-gray-700">
                      {treatment.notes != '' ? treatment.notes : '- Tidak ada catatan dari dokter'}
                    </td>
                  </tr>

                </tbody>
              </table>

              <div class="max-w-[480px] mt-4 relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded-lg ">
                <div class="rounded-t mb-0 px-4 py-3 border-0">
                  <div class="flex flex-wrap items-center">
                    <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                      <h3 class="font-semibold text-base text-blueGray-700">Medicines</h3>
                    </div>
                    <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                    </div>
                  </div>
                </div>
                <div class="block w-full overflow-x-auto">
                  <table class="items-center bg-transparent w-full border-collapse ">
                    <thead>
                      <tr>
                        <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                          Name
                        </th>
                        <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                          Dosis
                        </th>

                        <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                          Frequency
                        </th>

                      </tr>
                    </thead>

                    <tbody>
                      {treatment.medications ? (
                        treatment.medications.map((medision) => (
                          <tr>
                            <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                              {medision.name}
                            </th>
                            <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                              {medision.dosage}
                            </td>

                            <td class="border-t-0 px-6 font-semibold align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                              {medision.frequency}
                            </td>

                          </tr>

                        ))
                      ) : null}

                    </tbody>
                  </table>
                </div>
              </div>

            </div>


            <div className="rigth">
              <div className="bg-center group relative bg-cover h-[35vh] hover:h-[45vh] duration-500 mb-4 rounded-md border " style={{ backgroundImage: `url('${treatment.doctor.profilePicture}')` }}>
                <div className="bg-black/40 group-hover:bg-black/10 absolute left-0 top-0 w-full h-full rounded-md"></div>
              </div>
              <table class="sm:max-w-[480px] border border-slate-800 lg:min-w-[400px] bg-white shadow-md rounded-lg overflow-hidden">
                <tbody>
                  <tr class="bg-white border-b">
                    <th class="px-6 py-4 whitespace-nowrap text-left text-[14px] font-semibold text-gray-900">
                      Ditulis oleh:
                    </th>
                    <td class="px-6 py-4 text-sm text-gray-700">

                    </td>
                  </tr>

                  <tr class="bg-[#E2E3FF]/90 border-b">
                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                      Name
                    </th>
                    <td class="px-6 py-4 text-sm text-gray-700">
                      {treatment.doctor.name}
                    </td>
                  </tr>
                  <tr class="bg-white border-b">
                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                      No Handphone
                    </th>
                    <td class="px-6 py-4 text-sm text-gray-700">
                      {treatment.doctor.phone_number}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}


        <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t mb-0 px-4 py-3 border-0 bg-white">
            <div class="flex flex-wrap items-center bg-white">
              <div class="relative w-full px-4 max-w-full flex justify-between bg-white">
                <h3 class="font-semibold text-lg text-blueGray-700 bg-white">History Treatment</h3>
                {currentUser.role != 'user' && !treatment ? (
                  <Link to="/treatment/create" className="w-fit px-3 py-1 bg-blue-500 hover:bg-blue-500/90 text-[12px] font-medium text-white rounded-md">Create Treatment</Link>

                ) : null}
              </div>
              <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">

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
                    Diagnosa
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Dokter
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Status
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {history.length > 0 ? (
                  history.map((val, i) => (
                    <tr>
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
      </div>
    </main>

  )
}

export default Treatment