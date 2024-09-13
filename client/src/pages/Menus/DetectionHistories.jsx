import React, { useState, useEffect } from 'react'
import Side from '../../components/Side';
import { useSelector } from 'react-redux';
import '../../loading2.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';

let data1 = [
  {
    dfa: -1,
    date: "",
    Aktifitas: "",
  },
];

function DetectionHistories() {

  const [data, setData] = useState(data1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [sort, setSort] = useState(null);
  const [sortByKey, setSortByKey] = useState(null);
  const [isLoading, setLoading] = useState(false);
  const { currentUser, DocterPatient } = useSelector(state => state.user);
  const [pagination, setPagination] = useState(0);
  const [currentPagination, setCurrentPagination] = useState(1);
  // const {currentUser} = useSelector(state => state.user);

  const sortedData = React.useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    setSortByKey(key);
    setSort('ascending')
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
      setSort('descending')
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    fectInit();
  }, [currentPagination]);

  const handleChangePagination = (num) => {
    if (num > 0 && num < pagination + 1) {
      setCurrentPagination(num);
    }
  }

  const fectInit = async () => {
    try {
      setLoading(true)
      let url = `/api/user/riwayatdeteksi/${currentUser._id}`
      if (currentUser.role != 'user') {
        url = `/api/user/riwayatdeteksi/${DocterPatient._id}`
      }
      if (currentPagination > 0) {
        url += `?page=${currentPagination - 1}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      console.log(data)
      setData(data.riwayat);
      setPagination(data.totalPagination);

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fectInit();
  }, [])

  return (
    <main class="bg-white flex">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-24">
        <ButtonOffCanvas />
        <h3 class="mb-3 mt-2 text-[20px] font-bold text-blueGray-700">Riwayat Deteksi</h3>
        <p>Keterangan Simbolis  </p>
        <ul style={{ listStyle: 'inside' }} className='text-sm md:text-base'>
          <li>*Hijau menandakan kestabilan nilai DFA</li>
          <li>*Orange menandakan adanya deteksi yang perlu diwaspadai ketika anda sedang melakukan aktifitas</li>
          <li>*Merah menandakan adanya deteksi berbahaya ketika anda sedang beraktivitas dan perlu ditindak lanjuti</li>
        </ul>
        <div class="relative mt-4 flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">


          <div class="rounded-t mb-0 px-4 py-3 border-0">
            <div class="flex flex-wrap items-center">
              <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                {sortByKey && sort ? (
                  <>
                    Filter by {sortByKey} : {sort ?? ''}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div class="block w-full overflow-x-auto">
            <table class="items-center bg-transparent w-full border-collapse ">
              <thead>
                <tr>
                  <th title='sort by date' onClick={() => requestSort('date')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Tanggal
                  </th>
                  <th title='sort by date' onClick={() => requestSort('time')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Time
                  </th>
                  <th title='sort by dfa' onClick={() => requestSort('dfa')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Nilai DFA
                  </th>
                  <th title='sort by activity' onClick={() => requestSort('aktifitas')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Aktivitas
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Simbolis
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedData.length > 0 ?
                  sortedData.map((val) => {
                    return (
                      <tr>
                        <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                          {val.date.replace('-', '/').replace('-', '/')}
                        </th>
                        <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                          {val.time}
                        </th>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {val.dfa > 0 ? val.dfa.toFixed(2) : null}
                        </td>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {val.aktifitas}
                        </td>
                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                          {val.dfa == 0 ? (
                            <span
                              className="w-fit px-3 py-1 text-[12px] rounded-md bg-slate-800 text-white font-medium" >
                              Cant calculate dfa.
                            </span>
                          ) : (
                            <HandleSimbol dfa={val.dfa} />
                          )}
                        </td>
                      </tr>
                    )
                  }) : null}
              </tbody>
            </table>

          </div>

        </div>
        {/* pagination */}
        <nav aria-label="Page navigation example" className='pb-5 max-w-[400px]' style={{overflowX : 'auto'}}>
          <ul class="flex items-center -space-x-px h-8 text-sm">
            <li onClick={() => handleChangePagination(currentPagination - 1)}>
              <p href="#" class="flex items-center justify-center px-3 h-8 ms-0 leading-tight text-gray-500 bg-white border border-e-0 border-gray-300 rounded-s-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                <span class="sr-only">Previous</span>
                <svg class="w-2.5 h-2.5 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 1 1 5l4 4" />
                </svg>
              </p>
            </li>

            {Array.from({ length: pagination }).map((_i, i) => {

              if (i + 1 == currentPagination) {
                return (
                  <li className='cursor-pointer'>
                    <p href="#" class="flex items-center justify-center px-3 h-8 bg-blue-400">{i + 1}</p>
                  </li>
                )
              } else {
                return (
                  <li className='cursor-pointer' onClick={() => handleChangePagination(i + 1)}>
                    <p href="#" class="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">{i + 1}</p>
                  </li>
                )
              }
            })}

            <li onClick={() => handleChangePagination(currentPagination + 1)}>
              <p href="#" class="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-e-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                <span class="sr-only">Next</span>
                <svg class="w-2.5 h-2.5 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4" />
                </svg>
              </p>
            </li>
          </ul>
        </nav>
        {isLoading ? (
          <div className="flex justify-center my-8 gap-3 items-center">
            <div class="loader2"></div>
            <div className="font-medium">Loading..</div>
          </div>
        ) : null}
      </div>
    </main>

  )
}

function HandleSimbol(props) {
  const { dfa } = props;

  if (dfa >= 1.5) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-red-600 text-white font-medium">
        Danger Area
      </span>
    )
  }

  else if (dfa >= 1.2) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-orange-600 text-white font-medium">
        Warning Area
      </span>

    )
  }

  else if (dfa > 0) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-green-500 text-white font-medium" >
        Safe Area
      </span>
    )
  }

}

export default DetectionHistories