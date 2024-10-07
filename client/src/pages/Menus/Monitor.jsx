import React, { useEffect, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';
import { useRef } from 'react';

import '../../loading.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import DailyMetric from '../../components/DailyMetric';

// import '../../tableresponsive.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import LineGraph from '../../components/LineGraph';
import ScatterGraph from '../../components/ScatterGraph';
import AOS from 'aos';


let results = []

export default function Monitor() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  // set redux and make good performance
  const { dailymetricR, logsR, medianPropertyR, metricsR, borderColorR } = useSelector((state) => state.data);

  const [logs, setLogs] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metrics, setMetrics] = useState({ rmssd: null, pnn50: null, sdnn: null, s1: null, s2: null });
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [isHRVisible, setHRIsVisible] = useState(false); // Show HR chart by default
  const [isRRVisible, setRRIsVisible] = useState(false); // Show RR chart by default
  const [isPoincareVisible, setPoincareIsVisible] = useState(false); // Show Poincare chart by default
  const [device, setDevice] = useState("C0680226");
  const [loading, setLoading] = useState(false);
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
    AOS.init({
      duration: 700
    })
    fetchLogs(device);
    // readFileExistOnFTP('2023-07-24', '2024-08-29');
  }, []);

  useEffect(() => {
    if (startDate && endDate) {

      // dispatch(clearLogsWithDailytMetric());
      fetchLogs(device);
      console.log('berhasil filter by date')

    }
  }, [startDate, endDate]);

  const fetchLogs = async (device) => {
    try {
      setLoading(true);
      results = [];
      let url = `/api/user/test`;
      if (currentUser.role != 'user') {
        url = `/api/user/test/${device}`;
      }

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }
      console.log({ url }, currentUser.role != 'user' && device)
      const response = await fetch(url);
      const data = await response.json();
      console.log({ data })
      if (!response.ok) {
        setLogs([]);

        setMetrics([]);
        setDailyMetrics([]);

        dispatch(clearLogsWithDailytMetric());
        return
      }

      // let payloadRedux = {};
      const sortedLogs = data.logs.sort((a, b) => a.timestamp - b.timestamp); // Sort logs from newest to oldest
      setLogs(sortedLogs);
      setDailyMetrics(data.metricDaily); // butuh date
      // payloadRedux.logs = sortedLogs;

      // setBorderColor
      const borderColor = sortedLogs.map(item => {
        if (item.activity === 'Berjalan') return 'rgba(249, 39, 39, 0.8)'; // Merah untuk berjalan 
        if (item.activity === 'Tidur') return 'rgba(63, 234, 53, 0.8)'; // Hijau untuk tidur
        if (item.activity === 'Berolahraga') return 'rgba(116, 12, 224, 0.8)'; // Ungu untuk Berolahraga
        // return 'rgba(75, 192, 192, 1)'; // Warna default
        return 'rgba(7, 172, 123, 1)'; // Warna default
      });

      setBorderColor(borderColor);
      // payloadRedux.borderColorR = borderColor;

      // if (data && sortedLogs.length > 0) {
      //   const resultCalculateMetric = calculateMetrics(sortedLogs);
      //   setMetrics(resultCalculateMetric);
      //   // payloadRedux.metricsR = resultCalculateMetric;
      //   let dfaHR = sortedLogs.map(log => log.HR);

      //   const dailyMetrictResult = calculateDailyMetrics(sortedLogs, dfaHR); // call here
      //   setDailyMetrics(dailyMetrictResult);
      //   console.log({ dailyMetrictResult });

      //   // payloadRedux.dailymetricR = dailyMetrictResult;

      //   let property = {
      //     tSdnn: 0,
      //     tRmssd: 0,
      //     tPnn50: 0,
      //     tS1: 0,
      //     tS2: 0,
      //   }

      //   results.forEach((val) => {
      //     // console.log(val)
      //     property.tSdnn += val.sdnn;
      //     property.tRmssd += val.rmssd;
      //     property.tPnn50 += val.pnn50;
      //     property.tS1 += val.s1;
      //     property.tS2 += val.s2;
      //   });

      //   let median = {
      //     sdnn: property.tSdnn / results.length,
      //     rmssd: property.tRmssd / results.length,
      //     pnn50: property.tPnn50 / results.length,
      //     s1: property.tS1 / results.length,
      //     s2: property.tS2 / results.length,
      //     total: results.length
      //   }

      //   setMedianProperty(median);

      // payloadRedux.medianPropertyR = median;
      // dispatch(setLogsWithDailyMetric(payloadRedux));
      // dispatch(setDefautlFetchTrue());
      // console.log(median)
      // }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // const calculateDailyMetrics = (logs, CollectionHR) => {
  //   // console.log('HR', logs)
  //   const groupedLogs = logs.reduce((acc, log) => {
  //     const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
  //     if (!acc[date]) acc[date] = [];
  //     acc[date].push({ ...log });
  //     return acc;
  //   }, {});

  //   // Add DFA value here..
  //   // console.log(groupedLogs)

  //   const dailyMetrics = Object.keys(groupedLogs).map((date, i) => {
  //     // groupedLogs[date] adalah kumpulan logs sesuai dengan tanggal tanggal
  //     let groupData = groupedLogs[date];
  //     let HRPoint = [];
  //     for (let i = 0; i < groupData.length; i++) {
  //       // const element = groupData[i];
  //       HRPoint.push(groupData[i]['HR']);
  //       // let HRPoint = groupData[i].map(data => data.HR)
  //       // console.log('HRPOINT : ', HRPoint);
  //     }

  //     const dfa = calculateDFA(HRPoint);

  //     // console.log(groupedLogs[date], i)
  //     const metrics = calculateMetrics(groupedLogs[date]);
  //     return { date, ...metrics, dfa };
  //   });

  //   // setDailyMetrics(dailyMetrics);
  //   return dailyMetrics;
  // };

  const toggleVisibilityHR = () => setHRIsVisible(!isHRVisible);
  const toggleVisibilityRR = () => setRRIsVisible(!isRRVisible);
  const toggleVisibilityPoincare = () => setPoincareIsVisible(!isPoincareVisible);

  // const formatDate = (unixTimestamp) => {
  //   const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
  //   return date.toLocaleString(); // Adjust the format as needed
  // };


  const handleChangeDevice = (e) => {
    e.preventDefault();
    setDevice(e.target.value);
    fetchLogs(e.target.value);
  }

  return (
    <div>
      <main className=''>
        <section className="bgg-bl flex text-white">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bgg-bl w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <ButtonOffCanvas index={2} />

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Monitoring</h1>

                </div>
                <div data-aos="fade-up" className="flex mt-4 items-center">
                  <div className="">
                    {/* <h4 className="text-lg font-semibold mb-2">Select Date Range</h4> */}
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
                      className="p-3 bg-[#2C2C2C] rounded text-sm md:text-[16px] lg:min-w-[320px]"
                    />
                    {/* {loading ? (
                      <span class="ms-4 loader "></span>
                    ) : null} */}

                  </div>
                  {currentUser.role == 'user' ? null : (
                    <div data-aos="fade-up" className="relative w-full sm:px-4 max-w-full flex-grow flex-1 flex justify-betwee">
                      <div className="md:flex justify-between items-center w-full">
                        <select name="" id="" className='p-3 bg-[#2C2C2C] rounded text-sm md:text-[16px] lg:min-w-[220px] px-3 py-3' onChange={handleChangeDevice}>
                          <option value="" disabled>Select device Monitoring</option>
                          <option value="C0680226" selected>C0680226</option>
                          <option value="BA903328">BA903328</option>
                        </select>
                        {loading ? (
                          <span class="ms-4 loader "></span>
                        ) : null}

                      </div>
                    </div>
                  )}

                </div>

                <DailyMetric dailyMetrics={dailyMetrics} medianProperty={medianProperty} />



              </div>
            </div>
            {logs ? (
              <div style={{ overflowX: 'auto', marginRight: 40 }}>

                <div className='flex flex-col gap-6'>
                  <LineGraph data={logs} label={`RR`} keyValue={`RR`} color={borderColor} />
                  <LineGraph data={logs} label={`HR`} keyValue={`HR`} color={borderColor} />
                  <ScatterGraph data={logs} label={`PointCare`} keyValue={`HR`} color={borderColor} />
                </div>
              </div>
            ) : null}
            {/* <div className="flex items-center rounded-md shadow-sm mt-4 mb-8 gap-1">
              <ToggleButton text="RR" isVisible={isRRVisible} onClick={toggleVisibilityRR} />
              <ToggleButton text="HR" isVisible={isHRVisible} onClick={toggleVisibilityHR} />
              <ToggleButton text="Poincare" isVisible={isPoincareVisible} onClick={toggleVisibilityPoincare} />
            </div>
            {logs ? (
              <GrafikMetric logs={logs} isHRVisible={isHRVisible} isRRVisible={isRRVisible} isPoincareVisible={isPoincareVisible} borderColor={borderColor} />
            ) : null} */}
          </div>
        </section>
      </main>
    </div>
  );
}

const ToggleButton = ({ text, isVisible, onClick }) => (
  <button
    className={`text-slate-800 hover:text-blue-600 text-sm bg-white hover:bg-slate-100 border ${isVisible ? 'border-slate-200' : ''
      } rounded-md font-medium px-4 py-2 inline-flex space-x-1 items-center`}
    onClick={onClick}
  >
    {isVisible ? `Hide ${text}` : `Show ${text}`}
  </button>
);
