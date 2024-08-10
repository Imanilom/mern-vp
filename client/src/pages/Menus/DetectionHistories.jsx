import React, { useState, useEffect } from 'react'
import Side from '../../components/Side';
import { useSelector } from 'react-redux';

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
  const { currentUser, DocterPatient } = useSelector(state => state.user);
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
    let handle = async () => {
      try {
        let url = `/api/user/riwayatdeteksi/${currentUser._id}`
        if (currentUser.role != 'user') {
          url = `/api/user/riwayatdeteksi/${DocterPatient._id}`
        }

        const res = await fetch(url);
        const data = await res.json();
        console.log(data)
        setData(data.riwayat);

      } catch (error) {
        console.log(error);
      }
    }

    console.log(currentUser)
    handle();
  }, [])

  return (
    <main class="bg-white flex">
      <Side />
      <div class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-24">
        <h3 class="mb-3 mt-4 text-base text-[18px] font-bold text-blueGray-700">Riwayat Deteksi</h3>
        <p>Keterangan Simbolis  </p>
        <ul style={{ listStyle: 'inside' }}>
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
                              Cant calculate dfa. logs should at least 8 items
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

  else if(dfa > 0) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-green-500 text-white font-medium" >
        Safe Area
      </span>
    )
  }

}

export default DetectionHistories