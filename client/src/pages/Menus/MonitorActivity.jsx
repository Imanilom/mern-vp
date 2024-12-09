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
import DfaActivityMetric from '../../components/DfaActivityMetric';
import DfaGraphicActivity from '../../components/DfaGraphicActivity';

let results = []

export default function MonitorActivity() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  // set redux and make good performance
  const { dailymetricR, logsR, medianPropertyR, metricsR, borderColorR } = useSelector((state) => state.data);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [logsGroup, setLogsGroup] = useState([]);
  const [isDfaActivity, setIsDfaActivity] = useState(false); // Show Grafik
  const [device, setDevice] = useState("C0680226");
  const [loading, setLoading] = useState(false);

  const [resultsDFA, setResults] = useState([]);
  const [resultsDFA2, setResults2] = useState([]);
  const [splittedLog, setSplittedLog] = useState([]);
  const [isDoneCalculate, setDoneCalculate] = useState(false);

  useEffect(() => {
    if (currentUser.guid == '' || !currentUser.guid) {
      setLoading(true);
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => {
        return navigate('/profile');
      });
    } else {

      AOS.init({
        duration: 700
      })
      fetchLogs(device);

    }
    // readFileExistOnFTP('2023-07-24', '2024-08-29');
  }, []);

  useEffect(() => {
    console.log({ resultsDFA2, splittedLog, resultsDFA })
    if (startDate && endDate) {
      fetchLogs(device);
    }
  }, [startDate, endDate]);

  // const calculateDFA = (data, order = 1) => {
  //   // Baseline
  //   const y = data.map((val, i) =>
  //     data.slice(0, i + 1).reduce(
  //       (acc, v) => acc + (v - data.reduce((acc, val) => acc + val, 0) / data.length),
  //       0
  //     )
  //   );

  //   // Segmentasi ukuran kotak
  //   const boxSizes = [...new Set(
  //     Array.from({ length: Math.log2(data.length) }, (_, i) => Math.pow(2, i + 1)).filter(
  //       val => val <= data.length / 2
  //     )
  //   )];

  //   const fluctuation = boxSizes.map(boxSize => {
  //     const reshaped = Array.from(
  //       { length: Math.floor(data.length / boxSize) },
  //       (_, i) => y.slice(i * boxSize, (i + 1) * boxSize)
  //     );

  //     const localTrends = reshaped.map(segment => {
  //       const x = Array.from({ length: segment.length }, (_, i) => i);
  //       const [a, b] = [0, 1].map(deg =>
  //         segment.reduce((acc, val, i) => acc + Math.pow(x[i], deg) * val, 0) / segment.length
  //       );
  //       return segment.map((val, i) => a * x[i] + b);
  //     });

  //     return Math.sqrt(
  //       localTrends
  //         .flatMap((trend, i) => trend.map((val, j) => Math.pow(val - reshaped[i][j], 2)))
  //         .reduce((acc, val) => acc + val, 0) /
  //       (reshaped.length * reshaped[0].length)
  //     );
  //   });

  //   // Log-log transform
  //   const [logBoxSizes, logFluctuation] = [boxSizes, fluctuation].map(arr =>
  //     arr.map(val => Math.log10(val))
  //   );

  //   // Pembagian ukuran kotak menjadi small scales dan large scales
  //   const midPoint = Math.floor(logBoxSizes.length / 2);

  //   const calculateAlpha = (x, y) => {
  //     const n = x.length;
  //     const sumX = x.reduce((acc, val) => acc + val, 0);
  //     const sumY = y.reduce((acc, val) => acc + val, 0);
  //     const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
  //     const sumX2 = x.reduce((acc, val) => acc + val * val, 0);

  //     return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  //   };

  //   // Hitung Alpha1 (small scales)
  //   const alpha1 = calculateAlpha(
  //     logBoxSizes.slice(0, midPoint),
  //     logFluctuation.slice(0, midPoint)
  //   );

  //   // Hitung Alpha2 (large scales)
  //   const alpha2 = calculateAlpha(
  //     logBoxSizes.slice(midPoint),
  //     logFluctuation.slice(midPoint)
  //   );

  //   return { alpha1, alpha2 };
  // };


  // const handleDataCalculateDfa = async (grouplog) => {
  //   try {
  //     let result = [];

  //     grouplog.map((d, i) => {
  //       let HrColl = [];

  //       d.details.map((val, _i) => {
  //         HrColl.push(val.HR);
  //       })

  //       if (HrColl.length > 8) {
  //         d.dfa = calculateDFA(HrColl);
  //       } else {
  //         d.dfa = {
  //           alpha1: 0,
  //           alpha2: 0
  //         };
  //       }
  //       result.push(d);
  //       console.log({ i }, d.dfa)
  //     });

  //     // setLogsGroup
  //     console.log({ result });
  //     setDoneCalculate(true);
  //   } catch (err) {
  //     console.log({ err })
  //   }


  // }
  
  const fetchLogs = async (device, metode) => {
    try {
      setDoneCalculate(false)
      setLoading(true);
      results = [];
      let url = `/api/user/dfa/activity`;
      if (device) {
        url = `/api/user/dfa/activity`;
      }

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        if (metode) url += `&method=${metode}`;
      } else {
        if (metode) url += `?method=${metode}`;
      }
      // let url = `/api/user/logdfa`;
      // if (device) {
      //   url = `/api/user/logdfa`;
      // }

      // if (startDate && endDate) {
      //   url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      // }

      const response = await fetch(url);
      const data = await response.json();
      console.log({ data })

      if (!response.ok) {
        setMetrics([]);
        setLogsGroup([]);
        return
      }

      setMetrics(data.Metrics);
      setLogsGroup(data.groupLogsByActivity);
      
      // handleDataCalculateDfa(data.groupLogsByActivity);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // const handleChangeMetode = (e) => {
  //   e.preventDefault();
  //   setMetode(e.target.value);
  //   fetchLogs(device, e.target.value);
  // }

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
          <div className="w-full  xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8">
            <div className="relative flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  {/* <ButtonOffCanvas index={2} /> */}

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Monitoring DFA Activity</h1>

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

                {/* <select
                  name=""
                  id=""
                   className="lg:p-2.5 p-3 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] md:max-w-[200px] rounded text-sm w-full  md:text-[16px] lg:min-w-[220px] px-3 py-3"
                  onChange={handleChangeMetode}
                >
                  <option value="" disabled selected>Choose metode</option>
                  <option value="OC">OC</option>
                  <option value="IQ">IQ</option>
                  <option value="BC">BC</option>
                  <option value="no-filter">No filter</option>
                </select> */}


                {/* {currentUser.role !== 'user' && ( */}
                {/* <div data-aos="fade-up" className="inline-block relative">
                    <select
                      name=""
                      id=""
                      className="p-3 bg-[#2C2C2C] rounded text-sm md:text-[16px] lg:min-w-[220px] px-3 py-3"
                      onChange={handleChangeDevice}
                    >
                      <option value="" disabled>Select device Monitoring</option>
                      <option value="C0680226" selected>C0680226</option>
                      <option value="BA903328">BA903328</option>
                    </select>
                    {loading ? <span className="ms-4 loader"></span> : null}
                  </div> */}
                {/* )} */}

                {resultsDFA ? (
                  <DfaActivityMetric results={metrics} />
                ) : null}
              </div>
            </div>

            <div onClick={() => setIsDfaActivity(!isDfaActivity)} className={isDfaActivity && resultsDFA2.length > 0 ? `border-transparent bg-[#07AC7B] rounded-md flex mx-4 cursor-pointer dark:bg-[#101010]/10` : `cursor-pointer border border-gray-400 rounded-md flex mx-4 dark:bg-[#101010]/10`}>
              <button className='text-xs py-0.5 px-1.5 m-2'>{isDfaActivity ? 'Hide' : 'Show'} Graphic Aktivitas DFA</button>
            </div>
            {isDfaActivity && logsGroup.length > 0 ? (
              <DfaGraphicActivity data={logsGroup} label={"DfaActivity"} />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
