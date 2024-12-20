import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';

import '../../loading.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import AOS from 'aos';
import DfaMetrics from '../../components/DfaMetrics';
import DfaGraphic from '../../components/DfaGraphic';
import Swal from 'sweetalert2';
import DfaMetricsADFA from '../../components/DfaMetricsADFA';
import DfaGraphicADFA from '../../components/DfaGraphicADFA';

let results = []

export default function MonitorDFA() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  // set redux and make good performance
  const { dailymetricR, logsR, medianPropertyR, metricsR, borderColorR } = useSelector((state) => state.data);

  const [logs, setLogs] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [isDFAGraphVisible, setDfaGraphVisible] = useState(false);
  const [isADFAGraphVisible, setADfaGraphVisible] = useState(false);
  const [device, setDevice] = useState("C0680226");
  const [metode, setMetode] = useState("OC");
  const [loading, setLoading] = useState(false);


  const [borderColor, setBorderColor] = useState([]);
  const [resultsDFA, setResults] = useState([]);
  const [resultsDFA2, setResults2] = useState([]);
  const [splittedLog, setSplittedLog] = useState([]);

  // Jika input date range berubah, jalankan fungsi dibwh
  useEffect(() => {
    // console.log({ resultsDFA2, splittedLog, resultsDFA })
    if (startDate && endDate) {
      fetchLogs(device);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    // Mengecek apakah user memiliki guid yang valid
    if (currentUser.guid == '' || !currentUser.guid) {
      setLoading(true);
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => {
        // tendang ke profile untuk mengisi guid
        return navigate('/profile');
      });
    } else {
      // Panggil AOS untuk scrool animation
      AOS.init({
        duration: 700
      })

      fetchLogs(device); // run function
    }
  }, []);

  const fetchLogs = async (device, metode) => {
    try {
      setLoading(true); // tampilkan halaman loading

      results = [];

      // Fetching API
      let url = `/api/user/logdfa`;
      if (device) {
        url = `/api/user/logdfa`;
      }

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        if (metode) url += `&method=${metode}`;
      } else {
        if (metode) url += `?method=${metode}`;
      }

      const response = await fetch(url);
      const data = await response.json();
 
      if (!response.ok) {
        // Jika terjadi kesalahan, hentikan dan set semua variabel ke default
        setLogs([]);
        setDailyMetrics([]);
        setResults([]);
        setResults2([]);
        dispatch(clearLogsWithDailytMetric());
        return
      }
    
      // urutkan berdasarakna date
      let sortedResult = data.result.sort((a, b) => a.timestamp_tanggal - b.timestamp_tanggal);

      setResults(sortedResult); // menampung data untuk table
      setResults2(sortedResult); // menampung data untuk grafik

    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Change Metode
  const handleChangeMetode = (e) => {
    e.preventDefault(); // Menghindari web dimuat ulang
    setMetode(e.target.value);
    fetchLogs(device, e.target.value); // run function
  }

  return (
    <div>
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101010] dark:bg-[#FEFCF5]">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[#07AC7B] dark:border-[#217170] rounded-full animate-spin " style={{ animationDuration: '0.5s' }}></div>
            <p className="text-center font-semibold mt-4 text-[#07AC7B] dark:text-[#217170]">
              Loading...
            </p>
          </div>
        </div>

      ) : null}
      <main className=''>
        <section className="bg-[#101010] dark:bg-[#FEFCF5] flex text-white  dark:text-[#073B4C]">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 pb-8 xl:mb-0 px-4 mx-auto mt-5">
            <div className=" flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  {/* <ButtonOffCanvas index={2} /> */}

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Monitoring DFA</h1>

                </div>
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
                  className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded text-sm lg:me-0 me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
                />

                <select
                  name=""
                  id=""
                  className="lg:p-2.5 p-3 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] md:max-w-[200px] rounded text-sm w-full  md:text-[16px] lg:min-w-[220px] px-3 py-3"
                  onChange={handleChangeMetode}
                >
                  {/* <option value="" disabled selected>Choose metode</option> */}
                  <option value="groupactivity" selected>GroupActivity</option>
                  <option value="OC">OC</option>
                  <option value="IQ">IQ</option>
                  <option value="BC">BC</option>
                  <option value="no-filter">No filter</option>
                </select>

                {resultsDFA ? (
                  <DfaMetrics results={resultsDFA} splittedLog={splittedLog} />
                ) : null}

                {resultsDFA ? (
                  <DfaMetricsADFA results={resultsDFA} splittedLog={splittedLog} />
                ) : null}
              </div>
            </div>

            <div onClick={() => setDfaGraphVisible(!isDFAGraphVisible)} className={isDFAGraphVisible && resultsDFA2.length > 0 ? `border-transparent mb-3 bg-[#07AC7B] rounded-md flex mx-4 cursor-pointer dark:bg-[#101010]/10` : `mb-3 cursor-pointer border border-gray-400 rounded-md flex mx-4 dark:bg-[#101010]/10`}>
              <button className='text-xs py-0.5 px-1.5 m-2'>{isDFAGraphVisible ? 'Hide' : 'Show'} Graphic DFA</button>
            </div>
            {isDFAGraphVisible && resultsDFA2.length > 0 ? (
              <DfaGraphic data={resultsDFA2} label={`DFA`} keyValue={`dfa`} color={borderColor} />
            ) : null}

            <div onClick={() => setADfaGraphVisible(!isADFAGraphVisible)} className={isADFAGraphVisible && resultsDFA2.length > 0 ? `border-transparent mb-3 bg-[#07AC7B] rounded-md flex mx-4 cursor-pointer dark:bg-[#101010]/10` : `mb-3 cursor-pointer border border-gray-400 rounded-md flex mx-4 dark:bg-[#101010]/10`}>
              <button className='text-xs py-0.5 px-1.5 m-2'>{isADFAGraphVisible ? 'Hide' : 'Show'} Graphic ADFA</button>
            </div>
            {isADFAGraphVisible && resultsDFA2.length > 0 ? (
              <DfaGraphicADFA data={resultsDFA2} label={`DFA`} keyValue={`dfa`} color={borderColor} />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

