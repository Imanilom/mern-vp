import React, { useEffect, useState } from 'react'

import Side from '../../components/Side';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';

function Recommendation() {
  const { currentUser, loading, error } = useSelector((state) => state.user);

  const [recomendation, setRecomendation] = useState([]);
  const checkboxAction = async (id) => {

  }

  const handleDelete = async (id) => {
    let ask = window.confirm('Are you sure want to delete?');
    if (ask) {
      try {
        const res = await fetch(`/api/recomendation/delete/${id}`, {
          method: 'Delete'
        });

        const data = await res.json();
        console.log(data);
        setRecomendation(data.recomendations);

        Swal.fire({
          title: "Success",
          text: data.message,
          icon: "success",
          confirmButtonColor: "#3085d6",
        });

      } catch (error) {
        console.log(error);
      }
    }
  }

  useEffect(() => {
    const fetchtdata = async () => {
      console.log('process..');
      try {
        const res = await fetch('/api/recomendation/getAll', {
          method: 'GET',
          // headers: {
          //   'Content-Type': 'application/json'
          // }
        });

        const data = await res.json();
        console.log(data)
        setRecomendation(data.recomendation);
      } catch (error) {
        console.log(error);
      }
    }

    fetchtdata();
  }, [])

  return (
    <main class="bg-white flex">
      <Side />
      <div class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-24">
        <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t mb-0 px-4 py-3 border-0">
            <div class="flex flex-wrap items-center">
              <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                <h3 class="font-semibold text-base text-blueGray-700">Rekomendasi</h3>
              </div>
              <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                {currentUser.role !== 'user' ? (
                  <Link to="/createRecomendation">
                    <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Buat rekomendasi aktivitas</button>
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
                    Berlaku dari
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Hingga tanggal
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Aktivitas
                  </th>
                  {currentUser.role === 'user' ? (
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Status
                    </th>
                  ) : (
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Action
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {recomendation.length > 0 ? (
                  recomendation.map((recomendation) => {
                    return (
                      <tr>
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

                        {currentUser == 'user' ? (
                          <td class="border-t-0 px-6 flex gap-2 items-center align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            <input
                              type="checkbox"
                              onChange={() => checkboxAction('id')}
                              className="form-checkbox h-5 w-5 text-indigo-600"
                            />x
                          </td>
                        ) : (
                          <td class="border-t-0 px-6 flex gap-2 items-center align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            <Link to={`/rekomendasi/detail/${recomendation._id}`}>
                              <span className='bg-indigo-600 text-white font-medium py-1 px-3 rounded-md active:bg-indigo-600/80'>Detail</span>
                            </Link>
                            <Link to={`/updateRecomendation/${recomendation._id}`}>
                              <span className='bg-yellow-400 font-medium py-1 px-3 rounded-md active:bg-yellow-400/80'>Edit</span>
                            </Link>
                            <button onClick={() => handleDelete(recomendation._id)}>
                              <span className='bg-red-600 font-medium py-1 px-3 rounded-md active:bg-red-600/80 text-white'>Delete</span>
                            </button>
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
      </div>
    </main>
  );
}

export default Recommendation;