import React, { useEffect } from 'react'
import Side from '../../components/Side';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
function MedicalHistories() {

  const { currentUser, loading, error } = useSelector((state) => state.user);

  const handleDelete = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "Kamu tidak akan menemukan data ini lagi setelah dihapus.!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: "Deleted!",
          text: "Your file has been deleted.",
          icon: "success"
        });
      }
    });
  }

  useEffect(() => {
    console.log(currentUser);
  }, [])

  return (
    <main class="bg-white flex">
      <Side />
      <div class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-24">
        <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t mb-0 px-4 py-3 border-0">
            <div class="flex flex-wrap items-center">
              <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                {/* <h3 class="font-semibold text-base text-blueGray-700">Riwayat Medis</h3> */}
                <h3 class="font-semibold text-base text-blueGray-700">Catatan Medis Dokter</h3>
              </div>

              <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                {currentUser.role != 'user' ? (
                  <Link to={`/createAnamnesa`} >
                    <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Buat Anamnesa</button>
                  </Link>
                ) : null}
                <Link to={`/input-medical`}>
                  <button class="bg-green-500 text-white active:bg-green-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Lihat Detail</button>
                </Link>

                {currentUser.role == 'user' ? (
                  <Link to={`/input-medical`}>
                    <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Jawab Pertanyaan</button>
                  </Link>
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
                  {currentUser.role != 'user' ? (
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Action
                    </th>

                  ) : null}

                </tr>
              </thead>

              <tbody>
                <tr>
                  <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                    21 Jan 2022
                  </th>
                  <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                    Dr. Adam
                  </td>
                  <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    Penyakit yang pernah di derita
                  </td>
                  <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    Anamnesa
                  </td>
                  {currentUser.role != 'user' ? (
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 flex flex-col justify-end gap-1 text-white font-semibold">

                      <Link to={`/updateAnemnesa/:id`} className='w-fit rounded-md px-3 py-1 bg-yellow-400 active:bg-yellow-500'>Edit</Link>
                      <button onClick={() => handleDelete('id')} className='w-fit bg-red-500 active:bg-red-600 rounded-md px-3 py-1'>Delete</button>
                    </td>

                  ) : null}
                </tr>

                <tr>
                  <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700">
                    13 Maret 2023
                  </th>
                  <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    Dr. Ibrahim
                  </td>
                  <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    Hasil Radiologi
                  </td>
                  <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                    Memiliki kelainan di sel otak
                  </td>
                  {currentUser.role != 'user' ? (
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 flex flex-col justify-end gap-1 text-white font-semibold">
                      <button className='w-fit rounded-md px-3 py-1 bg-yellow-400 active:bg-yellow-500'>Edit</button>
                      <button className='w-fit bg-red-500 active:bg-red-600 rounded-md px-3 py-1'>Delete</button>
                    </td>

                  ) : null}
                </tr>
              </tbody>

            </table>
          </div>
        </div>
      </div>
    </main>

  )
}

export default MedicalHistories