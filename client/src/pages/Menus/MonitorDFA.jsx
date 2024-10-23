import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';

import '../../loading.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import DailyMetric from '../../components/DailyMetric';

// import '../../tableresponsive.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import LineGraph from '../../components/LineGraph';
import ScatterGraph from '../../components/ScatterGraph';
import AOS from 'aos';
import Graph3d from '../../components/Graph3d';
import InterquartileGraph from '../../components/InterquartileGraph';
import DfaMetrics from '../../components/DfaMetrics';
import DfaGraphic from '../../components/DfaGraphic';


let results = []

export default function MonitorDFA() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  // set redux and make good performance
  const { dailymetricR, logsR, medianPropertyR, metricsR, borderColorR } = useSelector((state) => state.data);

  const [logs, setLogs] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metrics, setMetrics] = useState({ rmssd: null, pnn50: null, sdnn: null, s1: null, s2: null });
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [isDFAGraphVisible, setDfaGraphVisible] = useState(false); // Show HR chart by default
  const [isRRVisible, setRRIsVisible] = useState(false); // Show RR chart by default
  const [isIQRVisible, setIQRIsVisible] = useState(false); // Show RR chart by default
  const [is3dpVisible, set3dpIsVisible] = useState(false); // Show RR chart by default
  const [isPoincareVisible, setPoincareIsVisible] = useState(false); // Show Poincare chart by default
  const [device, setDevice] = useState("C0680226");
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
  const [resultsDFA, setResults] = useState([]);
  const [resultsDFA2, setResults2] = useState([]);
  const [splittedLog, setSplittedLog] = useState([]);

  useEffect(() => {
    AOS.init({
      duration: 700
    })
    fetchLogs(device);
    // readFileExistOnFTP('2023-07-24', '2024-08-29');
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs(device);
    }
  }, [startDate, endDate]);

  const fetchLogs = async (device) => {
    try {
      setLoading(true);
      results = [];
      let url = `/api/user/logdfa`;
      if (device) {
        url = `/api/user/logdfa`;
      }

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
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
        return
      }

      setResults(data.result);
      setResults2(data.result);


    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibilityHR = () => setHRIsVisible(!isHRVisible);
  const toggleVisibilityRR = () => setRRIsVisible(!isRRVisible);
  const toggleVisibilityPoincare = () => setPoincareIsVisible(!isPoincareVisible);
  const toggleVisibility3dp = () => set3dpIsVisible(!is3dpVisible);
  const toggleVisibilityIQR = () => setIQRIsVisible(!isIQRVisible);

  return (
    <div>
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bgg-bl">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[#07AC7B] rounded-full animate-spin " style={{ animationDuration: '0.5s' }}></div>
            <p className="text-center font-semibold mt-4 text-[#07AC7B]">
              Loading...
            </p>
          </div>
        </div>

      ) : null}
      <main className=''>
        <section className="bgg-bl flex text-white">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bgg-bl w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <ButtonOffCanvas index={2} />

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
                  className="p-3 bg-[#2C2C2C] rounded text-sm me-3 mt-3 md:text-[16px] lg:min-w-[320px] w-fit inline-block"
                />

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
                  <DfaMetrics results={resultsDFA} splittedLog={splittedLog} />
                ) : null}
              </div>
            </div>

            <div onClick={() => setDfaGraphVisible(!isDFAGraphVisible)} className={isDFAGraphVisible  && resultsDFA2.length > 0 ? `border-transparent bgg-dg rounded-md flex mx-4 cursor-pointer` : `cursor-pointer border border-gray-400 rounded-md flex mx-4`}>
              <button className='text-xs py-0.5 px-1.5 m-2'>{isDFAGraphVisible ? 'Hide' : 'Show'} Graphic DFA</button>
            </div>
            {isDFAGraphVisible && resultsDFA2.length > 0 ? (
              <DfaGraphic data={resultsDFA2} label={`DFA`} keyValue={`dfa`} color={borderColor} />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

