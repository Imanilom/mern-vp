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

  const fetchLogs = async (device) => {
    try {
      setLoading(true);
      results = [];
      let url = `/api/user/test`;
      if (device) {
        url = `/api/user/test/${device}`;
      }

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }
      const response = await fetch(url);  
      const data = await response.json();

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

      let payloadRedux = {};
      const sortedLogs = data.logs.sort((a, b) => a.timestamp - b.timestamp); // Sort logs from newest to oldest
      const tes = groupDataByThreeAndAverage(sortedLogs);

      // console.log({iQrData})
      set3dpData(tes);
      setLogs(sortedLogs);
      setIQRData(data.filterIQRResult);

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

      if (data && sortedLogs.length > 0) {
        const resultCalculateMetric = calculateMetrics(sortedLogs);
        setMetrics(resultCalculateMetric);
        // payloadRedux.metricsR = resultCalculateMetric;
        let dfaHR = sortedLogs.map(log => log.HR);

        const dailyMetrictResult = calculateDailyMetrics(sortedLogs, dfaHR); // call here
        setDailyMetrics(dailyMetrictResult);

        // payloadRedux.dailymetricR = dailyMetrictResult;

        let property = {
          tSdnn: 0,
          tRmssd: 0,
          tPnn50: 0,
          tS1: 0,
          tS2: 0,
        }

        dailyMetrictResult.forEach((val) => {
          // console.log(val)
          property.tSdnn += Math.floor(val.sdnn);
          property.tRmssd += Math.floor(val.rmssd);
          property.tPnn50 += Math.floor(val.pnn50);
          property.tS1 += Math.floor(val.s1);
          property.tS2 += Math.floor(val.s2);
        });

        let median = {
          sdnn: property.tSdnn / dailyMetrictResult.length,
          rmssd: property.tRmssd / dailyMetrictResult.length,
          pnn50: property.tPnn50 / dailyMetrictResult.length,
          s1: property.tS1 / dailyMetrictResult.length,
          s2: property.tS2 / dailyMetrictResult.length,
          total: dailyMetrictResult.length
        }

        console.log({results})

        setMedianProperty(median);

        payloadRedux.medianPropertyR = median;
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

  const calculateDFA = (data, order = 1) => {
    const y = data.map((val, i) => data.slice(0, i + 1)
      .reduce((acc, v) => acc + (v - data.reduce((acc, val) => acc + val, 0) / data.length), 0));
    const boxSizes = [...new Set(Array.from({ length: Math.log2(data.length) }, (_, i) => Math.pow(2, i + 1)).filter(val => val <= data.length / 2))];
    const fluctuation = boxSizes.map(boxSize => {
      const reshaped = Array.from({ length: Math.floor(data.length / boxSize) }, (_, i) => y.slice(i * boxSize, (i + 1) * boxSize));
      const localTrends = reshaped.map(segment => {
        const x = Array.from({ length: segment.length }, (_, i) => i);
        const [a, b] = [0, 1].map(deg => segment.reduce((acc, val, i) => acc + Math.pow(x[i], deg) * val, 0) / segment.length);
        return segment.map((val, i) => a * x[i] + b);
      });
      return Math.sqrt(localTrends.flatMap((trend, i) => trend.map((val, j) => Math.pow(val - reshaped[i][j], 2)))
        .reduce((acc, val) => acc + val, 0) / (reshaped.length * reshaped[0].length));
    });
    const [logBoxSizes, logFluctuation] = [boxSizes, fluctuation].map(arr => arr.map(val => Math.log10(val)));
    const alpha = (logFluctuation.reduce((acc, val, i) => acc + (val * logBoxSizes[i]), 0) -
      (logFluctuation.reduce((acc, val) => acc + val, 0) * logBoxSizes.reduce((acc, val) => acc + val, 0) / logBoxSizes.length)) /
      (logBoxSizes.reduce((acc, val) => acc + Math.pow(val, 2), 0) - Math.pow(logBoxSizes.reduce((acc, val) => acc + val, 0), 2) / logBoxSizes.length);
    return alpha;
  };

  const groupDataByThreeAndAverage = (datalog) => {
    const groupedData = [];

    // Petakan data untuk mengambil nilai HR dan created_at
    const data = datalog.map(log => ({
      HR: log.HR,
      date: log.create_at
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

  const calculateDailyMetrics = (logs, CollectionHR) => {
    const groupedLogs = logs.reduce((acc, log) => {
      const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push({ ...log });
      return acc;
    }, {});

    const dailyMetrics = Object.keys(groupedLogs).map((date, i) => {
      // groupedLogs[date] adalah kumpulan logs sesuai dengan tanggal tanggal
      let groupData = groupedLogs[date];
      let HRPoint = [];
      for (let i = 0; i < groupData.length; i++) {
        // const element = groupData[i];
        HRPoint.push(groupData[i]['HR']);
        // let HRPoint = groupData[i].map(data => data.HR)
        // console.log('HRPOINT : ', HRPoint);
      }

      const dfa = calculateDFA(HRPoint);

      // console.log(groupedLogs[date], i)
      const metrics = calculateMetrics(groupedLogs[date]);
      return { date, ...metrics, dfa };
    });

    // setDailyMetrics(dailyMetrics);
    return dailyMetrics;
  };

  const toggleVisibilityHR = () => setHRIsVisible(!isHRVisible);
  const toggleVisibilityRR = () => setRRIsVisible(!isRRVisible);
  const toggleVisibilityPoincare = () => setPoincareIsVisible(!isPoincareVisible);
  const toggleVisibility3dp = () => set3dpIsVisible(!is3dpVisible);
  const toggleVisibilityIQR = () => setIQRIsVisible(!isIQRVisible);

  const handleChangeDevice = (e) => {
    e.preventDefault();
    setDevice(e.target.value);
    fetchLogs(e.target.value);
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
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <ButtonOffCanvas index={2} />

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Monitoring</h1>

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
                  <div data-aos="fade-up" className="inline-block relative">
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
                  </div>
                {/* )} */}

                <DailyMetric dailyMetrics={dailyMetrics} medianProperty={medianProperty} />

              </div>
            </div>
            {logs ? (
              <div style={{ overflowX: 'auto', marginRight: 40 }}>
                <div className='flex flex-col gap-3 ms-4 cursor-pointer pt-3 pb-5'>
                  <div className="flex-col flex">
                    <div onClick={toggleVisibilityHR} className={isHRVisible ? `border-transparent bgg-dg rounded-md flex` : `border border-gray-400 rounded-md flex`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isHRVisible ? 'Hide' : 'Show'} Graphic HR</button>
                    </div>
                    {isHRVisible ? (
                      <LineGraph data={logs} label={`HR`} keyValue={`HR`} color={borderColor} />
                    ) : null}
                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibilityRR} className={isRRVisible ? `border-transparent bgg-dg rounded-md flex` : `border border-gray-400 rounded-md flex`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isRRVisible ? 'Hide' : 'Show'} Graphic RR</button>
                    </div>
                    {isRRVisible ? (
                      <LineGraph data={logs} label={`RR`} keyValue={`RR`} color={borderColor} />
                    ) : null}
                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibility3dp} className={is3dpVisible ? `border-transparent bgg-dg rounded-md flex` : `border border-gray-400 rounded-md flex`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{is3dpVisible ? 'Hide' : 'Show'} Graphic 3dpfilter</button>
                    </div>
                    {is3dpVisible ? (
                      <Graph3d data={data3Dp} label={`Data3dp`} color={borderColor} />
                    ) : null}
                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibilityIQR} className={isIQRVisible ? `border-transparent bgg-dg rounded-md flex` : `border border-gray-400 rounded-md flex`}>
                      <button className='text-xs py-0.5 px-1.5 m-2'>{isIQRVisible ? 'Hide' : 'Show'} Graphic IQR</button>
                    </div>
                    {isIQRVisible ? (
                      <InterquartileGraph data={IQRData} label={`InterQuartile`} color={borderColor} />
                    ) : null}

                  </div>
                  <div className="flex-col flex gap-2">
                    <div onClick={toggleVisibilityPoincare} className={isPoincareVisible ? `border-transparent bgg-dg rounded-md flex` : `border border-gray-400 rounded-md flex`}>
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

