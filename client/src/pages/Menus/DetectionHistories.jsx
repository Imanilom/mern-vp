import React, { useState, useEffect } from 'react'
import Side from '../../components/Side';
import { useSelector } from 'react-redux';
import '../../loading2.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import DatePicker from 'react-datepicker';
import AOS from 'aos';

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
  const [state, setState] = useState('safe');
  // const {currentUser} = useSelector(state => state.user);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

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

  useEffect(() => {
    if (startDate && endDate) {
      fectInit();
    }
  }, [startDate, endDate]);

  const handleChangePagination = (num) => {
    if (num > 0 && num < pagination + 1) {
      setCurrentPagination(num);
    }
  }

  const fectInit = async () => {
    try {
      setLoading(true)
      let url = `/api/user/riwayatdeteksi/${currentUser._id}?page=${currentPagination - 1}`
      if (currentUser.role != 'user') {
        url = `/api/user/riwayatdeteksi/${DocterPatient._id}?page=${currentPagination - 1}`
      }
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      // if (currentPagination > 0) {
      //   url += `?page=${currentPagination - 1}`;
      // }

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
    AOS.init({
      duration: 700
    })
    fectInit();
  }, [])

  const handleText = (state) => {
    if (state == 'safe') {
      return (
        <div className='w-[330px] flex-col flex gap-3 text-sm'>
          <p>Hijau, warna hijau memiliki arti bahwa system kami mengenali bahwa aktivitas anda aman, tidak ada anomali.</p>
          <button className='w-fit px-2 text-[#101010] font-semibold py-1 bg-[#46FF59]/70 rounded'>Safe</button>
        </div>
      )
    }
    if (state == 'warning') {
      return (
        <div className='md:w-6/12 flex-col flex gap-3 text-sm'>
          <p>Orange, warna orange memiliki arti bahwa sistem kami mengenali adanya deteksi yang perlu diwaspadai. ketika anda sedang melakukan aktifitas</p>
          <button className='w-fit px-2 text-[#101010] font-semibold py-1 bg-[#F47500]/70 rounded'>Warning</button>
        </div>
      )
    }
    if (state == 'danger') {
      return (
        <div className='md:w-6/12 flex-col flex gap-3 text-sm'>
          <p>Merah, warna Merah memiliki arti bahwa system kami mengenali adanya deteksi yang perlu ditangani</p>
          <button className='w-fit px-2 text-[#101010] font-semibold py-1 bg-[#F40000]/70 rounded'>Danger</button>
        </div>
      )
    }
    if (state == 'undefined') {
      return (
        <div className='md:w-6/12 flex-col flex gap-3 text-sm'>
          <p>Putih, warna Putih memiliki arti bahwa system kami tidak cukup mempunyai data untuk diproses, hal ini bisa terjadi ketika system kami kekurangan data dari anda. </p>
          <button className='w-fit px-2 text-[#101010] font-semibold py-1 bg-[#FFFFFF]/70 rounded'>System kekurangan data</button>
        </div>
      )
    }


  }

  return (
    <main class="bgg-bl text-white flex">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-16">
        <ButtonOffCanvas />
        <div data-aos="fade-up">

          <h1 class="text-3xl font-semibold capitalize lg:text-4xl mb-3">Riwayat Deteksi </h1>
          <p>Hey Pasien, kamu harus mengenali beberapa simbol berikut!  </p>
          {/* <ul style={{ listStyle: 'inside' }} className='text-sm md:text-base'>
          <li>*Hijau menandakan kestabilan nilai DFA</li>
          <li>*Orange menandakan adanya deteksi yang perlu diwaspadai ketika anda sedang melakukan aktifitas</li>
          <li>*Merah menandakan adanya deteksi berbahaya ketika anda sedang beraktivitas dan perlu ditindak lanjuti</li>
        </ul> */}
          <div className="flex gap-5 items-end justify-between">
            <div className="md:w-6/12 flex gap-5 my-3 items-center">
              <div className="w-fit text-sm text-[#101010] font-semibold flex flex-col gap-2 py-3">
                <button onClick={() => setState('safe')} className='bg-[#46FF59]/70 py-1 rounded px-3'>Click me</button>
                <button onClick={() => setState('warning')} className='bg-[#F47500]/70 py-1 rounded px-3'>Click me</button>
                <button onClick={() => setState('danger')} className='bg-[#F40000]/70 py-1 rounded px-3'>Click me</button>
                <button onClick={() => setState('undefined')} className='bg-[#FFFFFF]/70 py-1 rounded px-3'>Click me</button>
              </div>

              {/* <div className='md:w-6/12 flex-col flex gap-3'>
              <p>Hijau, warna hijau memiliki arti bahwa system kami mengenali bahwa aktivitas anda aman, tidak ada anomali.</p>
              <button className='w-fit px-2 text-[#101010] font-semibold py-1 bg-[#46FF59]'>Safe</button>
            </div> */}

              {handleText(state)}
            </div>

            {/* <div className=" ms-auto flex justify-end"> */}
              <DatePicker
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
                className="px-4 py-3 bg-[#2C2C2C] md:w-5/12 rounded ms-auto text-sm  lg:min-w-[320px]"
              />
            {/* </div> */}



          </div>
        </div>
        <div class="relative mt-4 flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t mb-0 px-4 py-3 border-0 bg-[#363636]/20">
            <div class="flex flex-wrap items-center">
              <div class="relative text-sm w-full px-4 max-w-full flex-grow flex-1">
                {sortByKey && sort ? (
                  <>
                    Filter by {sortByKey} : {sort ?? ''}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div data-aos="fade-right" class="block w-full overflow-x-auto">
            <table class="items-center bg-transparent w-full ">
              <thead>
                <tr className='bg-[#2f2f2f]'>
                  <th title='sort by date' onClick={() => requestSort('date')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Tanggal
                  </th>
                  <th title='sort by date' onClick={() => requestSort('time')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Time
                  </th>
                  <th title='sort by dfa' onClick={() => requestSort('dfa')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Nilai DFA
                  </th>
                  <th title='sort by activity' onClick={() => requestSort('aktifitas')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Aktivitas
                  </th>
                  <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                    Simbolis
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedData.length > 0 ?
                  sortedData.map((val, _i) => {
                    return (
                      <tr className={_i % 2 === 0 ? 'bg-[#141414]' : 'bg-[#2f2f2f]'}>
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
                              className="w-fit px-3 py-1 text-[12px] rounded-md bg-white/90 text-[#101010]  font-semibold" >
                              Data kurang untuk di proses
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
                  <div onClick={() => { handleChangePagination(i + 1); }} className="py-3 px-4 bg-[#272727] text-white cursor-pointer rounded-[5px]">
                    {i + 1}
                  </div>

                )
              }
            })}


          </div>
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