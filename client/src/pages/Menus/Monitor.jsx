import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';

import '../../loading.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import LineGraph from '../../components/LineGraph';
import ScatterGraph from '../../components/ScatterGraph';
import AOS from 'aos';
import Graph3d from '../../components/Graph3d';
import InterquartileGraph from '../../components/InterquartileGraph';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

let results = []

export default function Monitor() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [logs, setLogs] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metrics, setMetrics] = useState({ rmssd: null, pnn50: null, sdnn: null, s1: null, s2: null });
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [isHRVisible, setHRIsVisible] = useState(false); // Show HR chart by default
  const [isRRVisible, setRRIsVisible] = useState(true); // Show RR chart by default
  const [isIQRVisible, setIQRIsVisible] = useState(false); // Show RR chart by default
  const [is3dpVisible, set3dpIsVisible] = useState(false); // Show RR chart by default
  const [isPoincareVisible, setPoincareIsVisible] = useState(false); // Show Poincare chart by default
  const [device, setDevice] = useState("C0680226");
  const [metode, setMetode] = useState("OC");
  const metodeCollection = ["OC", "IQ", "BC"];
  const [loading, setLoading] = useState(false);
  const [data3Dp, set3dpData] = useState([]);
  const [IQRData, setIQRData] = useState([]);
  const [medianProperty, setMedianProperty] = useState({
    sdnn: 0,
    rmssd: 0,
    pnn50: 0,
    s1: 0,
    s2: 0,
    dfa: 0,
    total: 0
  });
  const [borderColor, setBorderColor] = useState([]);

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
    if (startDate && endDate) {

      dispatch(clearLogsWithDailytMetric());
      fetchLogs(device, metode);

    }
  }, [startDate, endDate]);

  const fetchLogs = async (device, metode) => {
    try {
      setLoading(true);
      results = [];
      let url = `/api/user/test`;
      if (device) {
        url = `/api/user/test/${device}`;
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
        console.log('error');
        setLogs([]);

        setMetrics([]);
        setDailyMetrics([]);
        set3dpData([]);
        setIQRData([]);

        dispatch(clearLogsWithDailytMetric());
        setLoading(false);
        return
      }

      // let payloadRedux = {};
      const sortedLogs = data.logs.sort((a, b) => a.timestamp - b.timestamp); // Sort logs from newest to oldest
      const tes = groupDataByThreeAndAverage(sortedLogs);

      console.log({ sortedLogs, tes, data })
      set3dpData(tes);
      setLogs(sortedLogs);
      setIQRData(data.filterIQRResult);

      // // setBorderColor
      const borderColor = sortedLogs.map(item => {
        if (item.activity === 'Berjalan') return 'rgba(249, 39, 39, 0.8)'; // Merah untuk berjalan 
        if (item.activity === 'Tidur') return 'rgba(63, 234, 53, 0.8)'; // Hijau untuk tidur
        if (item.activity === 'Berolahraga') return 'rgba(116, 12, 224, 0.8)'; // Ungu untuk Berolahraga
        // return 'rgba(75, 192, 192, 1)'; // Warna default
        return 'rgba(7, 172, 123, 1)'; // Warna default
      });

      setBorderColor(borderColor);
      // // payloadRedux.borderColorR = borderColor;


    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDataByThreeAndAverage = (datalog) => {
    const groupedData = [];

    // Petakan data untuk mengambil nilai HR dan created_at
    const data = datalog.map(log => ({
      HR: log.HR,
      date: new Date(log.timestamp * 1000)
    }));

    // Loop melalui data dan kelompokan berdasarkan 3 log
    for (let i = 0; i < data.length; i += 3) {
      const chunk = data.slice(i, i + 3);

      // Jika ada 3 item dalam grup
      if (chunk.length === 3) {
        const avg = chunk.reduce((sum, log) => sum + log.HR, 0) / 3;

        // Ambil tanggal dari log pertama di chunk
        const date = chunk[0].date;

        // Tambahkan [date, avg] ke hasil groupedData
        groupedData.push({ date, avg });
      }
    }
    return groupedData;
  };



  const toggleVisibilityHR = () => setHRIsVisible(!isHRVisible);
  const toggleVisibilityRR = () => setRRIsVisible(!isRRVisible);
  const toggleVisibilityPoincare = () => setPoincareIsVisible(!isPoincareVisible);
  const toggleVisibility3dp = () => set3dpIsVisible(!is3dpVisible);
  const toggleVisibilityIQR = () => setIQRIsVisible(!isIQRVisible);

  const handleChangeDevice = (e) => {
    e.preventDefault();
    setDevice(e.target.value);
    fetchLogs(e.target.value, metode);
  }

  const handleChangeMetode = (e) => {
    e.preventDefault();
    setMetode(e.target.value);
    fetchLogs(device, e.target.value);
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
        <section className="bg-[#101010] dark:bg-[#FEFCF5] flex dark:text-[#073B4C] text-white">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0 ">
                <div className="flex flex-wrap items-center">
                  {/* <ButtonOffCanvas index={2} /> */}

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Grafik Monitoring</h1>

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
                  className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C]  dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded text-sm sm:me-0 me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
                />

                {/* {currentUser.role !== 'user' && ( */}
                {/* <div data-aos="fade-up" className="inline-block relative"> */}
                <select
                  name=""
                  id=""
                  className="lg:p-2.5 p-3 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm w-full md:max-w-[200px] md:text-[16px] lg:min-w-[220px] px-3 py-3"
                  onChange={handleChangeDevice}
                >
                  <option value="" disabled>Select device Monitoring</option>
                  <option value="C0680226" selected>C0680226</option>
                  <option value="BA903328">BA903328</option>
                </select>
                {loading ? <span className="ms-4 loader"></span> : null}
                {/* </div> */}
                {/* )} */}

                <select
                  name=""
                  id=""
                  className="lg:p-2.5 p-3 mt-4 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm w-full md:max-w-[200px] md:text-[16px] lg:min-w-[220px] px-3 py-3"
                  onChange={handleChangeMetode}
                >
                  <option value="" disabled selected>Choose metode</option>
                  <option value="OC">OC</option>
                  <option value="IQ">IQ</option>
                  <option value="BC">BC</option>
                </select>

                {/* <DailyMetric dailyMetrics={dailyMetrics} medianProperty={medianProperty} /> */}

              </div>
            </div>
            {logs ? (
              <div style={{ overflowX: 'auto', marginRight: 40 }}>
                <div className='flex flex-col gap-3 ms-4 cursor-pointer pt-3 pb-5'>
                  <div className="flex-col flex">
                    <div onClick={toggleVisibilityHR} className={isHRVisible ? `border-transparent text-white dark:text-white bg-[#07AC7B] dark:bg-[#217170] rounded-md flex` : `border border-gray-400 rounded-md flex dark:bg-[#101010]/10`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isHRVisible ? 'Hide' : 'Show'} Graphic HR</button>
                    </div>
                    {isHRVisible ? (
                      <LineGraph data={logs} label={`HR`} keyValue={`HR`} color={borderColor} />
                    ) : null}
                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibilityRR} className={isRRVisible ? `border-transparent text-white dark:text-white bg-[#07AC7B] dark:bg-[#217170] rounded-md flex` : `border border-gray-400 rounded-md flex dark:bg-[#101010]/10`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isRRVisible ? 'Hide' : 'Show'} Graphic RR</button>
                    </div>
                    {isRRVisible ? (
                      <LineGraph data={logs} label={`RR`} keyValue={`RR`} color={borderColor} />
                    ) : null}
                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibility3dp} className={is3dpVisible ? `border-transparent text-white dark:text-white bg-[#07AC7B] dark:bg-[#217170] rounded-md flex` : `border border-gray-400 rounded-md flex dark:bg-[#101010]/10`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{is3dpVisible ? 'Hide' : 'Show'} Graphic 3dpfilter</button>
                    </div>
                    {is3dpVisible ? (
                      <Graph3d data={data3Dp} label={`Data3dp`} color={borderColor} />
                    ) : null}
                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibilityIQR} className={isIQRVisible ? `border-transparent text-white dark:text-white bg-[#07AC7B] dark:bg-[#217170] rounded-md flex` : `border border-gray-400 rounded-md flex dark:bg-[#101010]/10`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isIQRVisible ? 'Hide' : 'Show'} Graphic IQR</button>
                    </div>
                    {isIQRVisible ? (
                      <InterquartileGraph data={IQRData} label={`InterQuartile`} color={borderColor} />
                    ) : null}

                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibilityPoincare} className={isPoincareVisible ? `border-transparent text-white dark:text-white bg-[#07AC7B] dark:bg-[#217170] rounded-md flex` : `border border-gray-400 rounded-md flex dark:bg-[#101010]/10`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isPoincareVisible ? 'Hide' : 'Show'} Graphic Pointcare</button>
                    </div>

                    {isPoincareVisible ? (
                      <ScatterGraph data={logs} label={`PointCare`} keyValue={`HR`} color={borderColor} />
                    ) : null}
                  </div>


                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

