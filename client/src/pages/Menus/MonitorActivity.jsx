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
    if (startDate && endDate) {
      fetchLogs(device);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    // Mengecek apakah guid user sudah ada dan valid
    if (currentUser.guid == '' || !currentUser.guid) {
      setLoading(true);
      // Tampilkan popup error
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => {
        // Arahkan ke halaman profile
        return navigate('/profile');
      });
    } else {

      // Panggil AOS untuk animasi on scrool
      AOS.init({
        duration: 700
      })

      fetchLogs(device); // run function
    }

  }, []);

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

                {metrics ? (
                  // table metrics
                  <DfaActivityMetric results={metrics} />
                ) : null}

              </div>
            </div>

            <div onClick={() => setIsDfaActivity(!isDfaActivity)} className={isDfaActivity && resultsDFA2.length > 0 ? `border-transparent bg-[#07AC7B] rounded-md flex mx-4 cursor-pointer dark:bg-[#101010]/10` : `cursor-pointer border border-gray-400 rounded-md flex mx-4 dark:bg-[#101010]/10`}>
              <button className='text-xs py-0.5 px-1.5 m-2'>{isDfaActivity ? 'Hide' : 'Show'} Graphic Aktivitas DFA</button>
            </div>
            {isDfaActivity && metrics.length > 0 ? (
              <DfaGraphicActivity data={metrics} label={"DfaActivity"} />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

