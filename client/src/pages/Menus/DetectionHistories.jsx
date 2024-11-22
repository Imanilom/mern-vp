import React, { useState, useEffect } from 'react'
import Side from '../../components/Side';
import { useSelector } from 'react-redux';
import '../../loading2.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import DatePicker from 'react-datepicker';
import AOS from 'aos';
import 'react-datepicker/dist/react-datepicker.css';


function DetectionHistories() {

  const [data, setData] = useState([]);
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
  const [metode, setMetode] = useState("OC");
  const [isShowTable, setShowTable] = useState(true);

  // const sortedData = React.useMemo(() => {
  //   let sortableItems = [...data];
  //   if (sortConfig !== null) {
  //     sortableItems.sort((a, b) => {
  //       if (a[sortConfig.key] < b[sortConfig.key]) {
  //         return sortConfig.direction === 'ascending' ? -1 : 1;
  //       }
  //       if (a[sortConfig.key] > b[sortConfig.key]) {
  //         return sortConfig.direction === 'ascending' ? 1 : -1;
  //       }
  //       return 0;
  //     });
  //   }
  //   return sortableItems;
  // }, [data, sortConfig]);

  // const requestSort = (key) => {
  //   setSortByKey(key);
  //   setSort('ascending')
  //   let direction = 'ascending';
  //   if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
  //     direction = 'descending';
  //     setSort('descending')
  //   }
  //   setSortConfig({ key, direction });
  // };

  useEffect(() => {
    fectInit();
  }, [currentPagination]);

  useEffect(() => {
    if (startDate && endDate) {
      setShowTable(true);
      fectInit(metode);
    }
  }, [startDate, endDate]);

  const handleChangePagination = (num) => {
    if (num > 0 && num < pagination + 1) {
      setCurrentPagination(num);
    }
  }

  const processData = (rawData, keyValue) => {
    // Urutkan data berdasarkan create_at
    const sortedData = rawData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    // Gunakan Set untuk menyimpan nilai unik
    const uniqueValues = new Set();

    // Filter data untuk menghilangkan duplikat
    return sortedData.filter(item => {
      const value = item[keyValue];
      if (!uniqueValues.has(value)) {
        uniqueValues.add(value);
        return true;
      }
      return false;
    });
  }

  const fectInit = async (metode) => {
    try {
      setLoading(true)

      // let url = `/api/user/riwayatdeteksi/${currentUser._id}?page=${currentPagination - 1}`
      // if (currentUser.role != 'user') {
      //   url = `/api/user/riwayatdeteksi/${DocterPatient._id}?page=${currentPagination - 1}`
      // }
      // if (startDate && endDate) {
      //   url += `&startDate=${startDate}&endDate=${endDate}`;
      // }

      let url = `/api/user/test`;

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        if (metode) url += `&method=${metode}`;
      } else {
        if (metode) url += `?method=${metode}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      console.log({ data });

      if(!data.logs){
        setData([]);
        return;
      }

      let properties = "RR";
      let logsData = processData(data.logs, properties);

      logsData = logsData.filter(d => d.HR !== null && d.RR !== null);
      let results = [];

      for (let i = 0; i < logsData.length; i++) {
        if (i > 0) {
          if (logsData[i - 1][properties] - logsData[i][properties] >= 10) {
            results.push(logsData[i]);
          }
        }
      }


      console.log({ results })

      setData(results);
      // setPagination(data.totalPagination);

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
    fectInit(metode);
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

  const handleChangeMetode = (e) => {
    e.preventDefault();
    setMetode(e.target.value);
    fectInit(e.target.value);
  }


  return (
    <main class="bgg-bl text-white flex">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-16">
        {/* <ButtonOffCanvas /> */}
        <div data-aos="fade-up">

          <h1 class="text-3xl font-semibold capitalize lg:text-4xl mb-3">Riwayat Deteksi </h1>
          <p>Hey Pasien, kamu harus mengenali beberapa simbol berikut!  </p>
          {/* <ul style={{ listStyle: 'inside' }} className='text-sm md:text-base'>
          <li>*Hijau menandakan kestabilan nilai DFA</li>
          <li>*Orange menandakan adanya deteksi yang perlu diwaspadai ketika anda sedang melakukan aktifitas</li>
          <li>*Merah menandakan adanya deteksi berbahaya ketika anda sedang beraktivitas dan perlu ditindak lanjuti</li>
        </ul> */}
          <div className="flex gap-5 lg:items-end lg:flex-row flex-col lg:justify-between">
            {/* <div className="lg:w-6/12 md:w-8/12 flex overflow-x-auto lg:flex-row flex-col gap-5 my-3 lg:items-center">
              <div className="w-fit text-sm text-[#101010] font-semibold flex lg:flex-col gap-2 py-3">
                <button onClick={() => setState('safe')} className='bg-[#46FF59]/70 py-1 min-w-[90px] md:min-w-[0px] rounded lg:ms-0 px-3'>Click me</button>
                <button onClick={() => setState('warning')} className='bg-[#F47500]/70 py-1 min-w-[90px] md:min-w-[0px] rounded px-3'>Click me</button>
                <button onClick={() => setState('danger')} className='bg-[#F40000]/70 py-1 min-w-[90px] md:min-w-[0px] rounded px-3'>Click me</button>
                <button onClick={() => setState('undefined')} className='bg-[#FFFFFF]/70 py-1 min-w-[90px] md:min-w-[0px] rounded px-3'>Click me</button>
              </div>

              <div className='md:w-6/12 flex-col flex gap-3'>
              <p>Hijau, warna hijau memiliki arti bahwa system kami mengenali bahwa aktivitas anda aman, tidak ada anomali.</p>
              <button className='w-fit px-2 text-[#101010] font-semibold py-1 bg-[#46FF59]'>Safe</button>
            </div>

              {handleText(state)}
            </div> */}

            {/* <div className=" ms-auto flex justify-end"> */}


            <div
              onFocus={() => setShowTable(false)}
              onBlur={() => {console.log('out'); setShowTable(true)}}
            >

              <DatePicker
                data-aos="fade-left"
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={(dates) => {
                  const [start, end] = dates;
                  setStartDate(start);
                  setEndDate(end);
                }}
                isClearable
                placeholderText='Cari berdasarkan range tanggal'
                className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] lg:mb-0 mb-4 rounded text-sm sm:me-0 me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
              />
            </div>

            <select
              name=""
              id=""
              className="lg:p-2.5 p-3 mt-4 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] rounded text-sm w-full md:max-w-[200px] md:text-[16px] lg:min-w-[220px] px-3 py-3"
              onChange={handleChangeMetode}
            >
              <option value="" disabled selected>Choose metode</option>
              <option value="OC">OC</option>
              <option value="IQ">IQ</option>
              <option value="BC">BC</option>
            </select>



            {/* </div> */}



          </div>
        </div>
        <div class=" mt-4 flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded ">
          {isShowTable && data.length > 0 ? (
            <div data-aos="fade-right" class=" w-full overflow-x-auto">
              <table class="z-[1] rounded-t items-center bg-transparent w-full ">
                <thead>
                  <tr className='bg-neutral-800 '>
                    <th title='sort by date' onClick={() => requestSort('date')} class="cursor-pointer px-6 bg-blueGray-50 text-blueGray-500 align-middle border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
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
                  {data.length > 0 ?
                    data.map((val, _i) => {
                      return (
                        <tr className={_i % 2 === 0 ? 'bg-[#141414]' : 'bg-[#2f2f2f]'}>
                          <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                            {/* {val.date ? val.date.replace('-', '/').replace('-', '/') : ''} */}
                            {val.datetime.split('T')[0]}
                          </th>
                          <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                            {/* {val.time} */}
                            {val.datetime.split('T')[1].replace('.000Z', '')}
                          </th>
                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            {val.dfa && val.dfa > 0 ? val.dfa.toFixed(2) : '-'}
                          </td>
                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            {val.aktifitas ?? '-'}
                          </td>
                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                            {val.dfa && val.dfa == 0 ? (
                              <span
                                className="w-fit px-3 py-1 text-[12px] rounded-md bg-white/90 text-[#101010]  font-semibold" >
                                Data kurang untuk di proses
                              </span>
                            ) : (
                              <HandleSimbol dfa={val.dfa ?? 2} />
                            )}
                          </td>
                        </tr>
                      )
                    }) : null}
                </tbody>
              </table>

            </div>
          ) : null}

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

export default DetectionHistories;