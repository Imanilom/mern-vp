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


let results = []

export default function Metrics() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);

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

      dispatch(clearLogsWithDailytMetric());
      fetchLogs(device);

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
        if(metode) url += `&method=${metode}`;
      }else{
        if(metode) url += `?method=${metode}`;
      }
      const response = await fetch(url);
      const data = await response.json();

      console.log({ data })
      if (!response.ok) {
        console.log('error');
        setLogs([]);

        setMetrics([]);
        setDailyMetrics([]);
      
        dispatch(clearLogsWithDailytMetric());
        setLoading(false);
        return
      }

      // let payloadRedux = {};
      const sortedLogs = data.logs.sort((a, b) => a.timestamp - b.timestamp); // Sort logs from newest to oldest

      // console.log({sortedLogs, tes})
      setLogs(sortedLogs);

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

      if (data && sortedLogs.length > 0) {
        const resultCalculateMetric = calculateMetrics(sortedLogs);

        setMetrics(resultCalculateMetric);
        const dailyMetrictResult = data.dailyMetric;
        console.log({dailyMetrictResult})
        setDailyMetrics(dailyMetrictResult);

        //   // payloadRedux.dailymetricR = dailyMetrictResult;
        let property = {
          tSdnn: 0,
          tRmssd: 0,
          tPnn50: 0,
          tS1: 0,
          tS2: 0,
          dfa : 0
        }

        dailyMetrictResult.forEach((val) => {
          // console.log(val)
          property.tSdnn += Math.floor(val.sdnn);
          property.tRmssd += Math.floor(val.rmssd);
          property.tPnn50 += Math.floor(val.pnn50);
          property.tS1 += Math.floor(val.s1);
          property.tS2 += Math.floor(val.s2);
          property.dfa += Math.floor(val.dfa)
        });

        let median = {
          sdnn: property.tSdnn / dailyMetrictResult.length,
          rmssd: property.tRmssd / dailyMetrictResult.length,
          pnn50: property.tPnn50 / dailyMetrictResult.length,
          s1: property.tS1 / dailyMetrictResult.length,
          s2: property.tS2 / dailyMetrictResult.length,
          total: dailyMetrictResult.length,
          dfa : property.dfa / dailyMetrictResult.length
        }

        console.log({median, dailyMetrictResult})
        setMedianProperty(median);

        //   payloadRedux.medianPropertyR = median;
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (logs) => {
    const rrIntervals = logs.map((log) => log.RR);
    const nnIntervals = [];
    if (rrIntervals.length < 2) {
      // Not enough data points to calculate metrics
      return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null };
    }
    let sumSquaredDiffs = 0; // For RMSSD
    let sumSuccessiveDiffs = 0; // For RMSSD
    let nn50Count = 0;

    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = Math.abs(rrIntervals[i] - rrIntervals[i - 1]);
      nnIntervals.push(diff);

      sumSquaredDiffs += diff * diff; // Square the difference and add to sum (for RMSSD)
      if (diff > 50) {
        nn50Count++;
      }
    }

    const avgNN = nnIntervals.reduce((sum, interval) => sum + interval, 0) / nnIntervals.length;

    const squaredDiffsFromMean = nnIntervals.map((interval) => Math.pow(interval - avgNN, 2));
    const sumSquaredDiffsFromMean = squaredDiffsFromMean.reduce((sum, diff) => sum + diff, 0);

    const variance = sumSquaredDiffsFromMean / (nnIntervals.length - 1);
    const sdnn = Math.sqrt(variance);

    const rmssd = Math.sqrt(sumSquaredDiffs / nnIntervals.length);
    const pnn50 = (nn50Count / nnIntervals.length) * 100;

    // Calculate S1 & S2
    const diff1 = rrIntervals.slice(1).map((val, index) => val - rrIntervals[index]);
    const sum1 = rrIntervals.slice(1).map((val, index) => val + rrIntervals[index]);

    const s1 = Math.sqrt(diff1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diff1.length) / Math.sqrt(2);
    const s2 = Math.sqrt(sum1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / sum1.length) / Math.sqrt(2);

    // task calculate DFA
    return { sdnn, rmssd, pnn50, s1, s2 };
  };

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
              <div className="rounded-t mb-0 px-4 py-3 border-0 ">
                <div className="flex flex-wrap items-center">
                  {/* <ButtonOffCanvas index={2} /> */}

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Metrics Data</h1>

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
                  className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] lg:mb-0 mb-4 rounded text-sm me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
                />

            
                <select
                    name=""
                    id=""
                    className="lg:p-2.5 p-3 pe-8 bg-[#2C2C2C] rounded text-sm  md:text-[16px] lg:min-w-[220px] px-3 py-3"
                    onChange={handleChangeMetode}
                  >
                    <option value="" disabled selected>Choose metode</option>
                    <option value="OC">OC</option>
                    <option value="IQ">IQ</option>
                    <option value="BC">BC</option>
                  </select>

                <DailyMetric dailyMetrics={dailyMetrics} medianProperty={medianProperty} />

              </div>
            </div>
            
          </div>
        </section>
      </main>
    </div>
  );
}

