import React, { useEffect, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";

import '../../loading.css';

let results = [];

const calculateDFA = (data, order = 1) => {
  const y = data.map((val, i) => data.slice(0, i + 1).reduce((acc, v) => acc + (v - data.reduce((acc, val) => acc + val, 0) / data.length), 0));
  const boxSizes = [...new Set(Array.from({ length: Math.log2(data.length) }, (_, i) => Math.pow(2, i + 1)).filter(val => val <= data.length / 2))];
  const fluctuation = boxSizes.map(boxSize => {
    const reshaped = Array.from({ length: Math.floor(data.length / boxSize) }, (_, i) => y.slice(i * boxSize, (i + 1) * boxSize));
    const localTrends = reshaped.map(segment => {
      const x = Array.from({ length: segment.length }, (_, i) => i);
      const [a, b] = [0, 1].map(deg => segment.reduce((acc, val, i) => acc + Math.pow(x[i], deg) * val, 0) / segment.length);
      return segment.map((val, i) => a * x[i] + b);
    });
    return Math.sqrt(localTrends.flatMap((trend, i) => trend.map((val, j) => Math.pow(val - reshaped[i][j], 2))).reduce((acc, val) => acc + val, 0) / (reshaped.length * reshaped[0].length));
  });
  const [logBoxSizes, logFluctuation] = [boxSizes, fluctuation].map(arr => arr.map(val => Math.log10(val)));
  const alpha = (logFluctuation.reduce((acc, val, i) => acc + (val * logBoxSizes[i]), 0) - (logFluctuation.reduce((acc, val) => acc + val, 0) * logBoxSizes.reduce((acc, val) => acc + val, 0) / logBoxSizes.length)) /
    (logBoxSizes.reduce((acc, val) => acc + Math.pow(val, 2), 0) - Math.pow(logBoxSizes.reduce((acc, val) => acc + val, 0), 2) / logBoxSizes.length);
  return alpha;
}

const calculateMetrics = (logs) => {
  const rrIntervals = logs.map((log) => log.RR);
  const nnIntervals = [];
  if (rrIntervals.length < 2) {
    // Not enough data points to calculate metrics
    return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null };
  }
  let sumSquaredDiffs = 0; // For SDNN
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
  const s1 = Math.sqrt(nnIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgNN, 2), 0) / nnIntervals.length);
  const s2 = Math.sqrt(nnIntervals.reduce((sum, interval) => sum + Math.pow(interval + avgNN, 2), 0) / nnIntervals.length);

  // console.log('dfa' , dfa)
  // console.log(logs)
  results.push({ sdnn, rmssd, pnn50, s1, s2 });
  return { sdnn, rmssd, pnn50, s1, s2 };
};

export default function Monitor() {
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [logs, setLogs] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metrics, setMetrics] = useState({ rmssd: null, pnn50: null, sdnn: null, s1: null, s2: null });
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [isHRVisible, setHRIsVisible] = useState(true); // Show HR chart by default
  const [isRRVisible, setRRIsVisible] = useState(true); // Show RR chart by default
  const [isPoincareVisible, setPoincareIsVisible] = useState(true); // Show Poincare chart by default
  const [device, setDevice] = useState(null);
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

  useEffect(() => {
    fetchLogs();
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
      let url = `/api/user/test`;
      if (currentUser.role != 'user' && device) {
        url = `/api/user/test/${device}`;
      }
      console.log(url);
      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      // console.log(data)
      if (!response.ok) {
        setLogs([]);
        setMetrics([]);
        setDailyMetrics([]);
        return
      }
      const sortedLogs = data.logs.sort((a, b) => b.timestamp - a.timestamp); // Sort logs from newest to oldest
      setLogs(sortedLogs);

      if (data && sortedLogs.length > 0) {
        setMetrics(calculateMetrics(sortedLogs));
        let dfaHR = sortedLogs.map(log => log.HR);

        calculateDailyMetrics(sortedLogs, dfaHR); // call here

        let property = {
          tSdnn: 0,
          tRmssd: 0,
          tPnn50: 0,
          tS1: 0,
          tS2: 0,
        }

        results.forEach((val) => {
          // console.log(val)
          property.tSdnn += val.sdnn;
          property.tRmssd += val.rmssd;
          property.tPnn50 += val.pnn50;
          property.tS1 += val.s1;
          property.tS2 += val.s2;


        });

        let median = {
          sdnn: property.tSdnn / results.length,
          rmssd: property.tRmssd / results.length,
          pnn50: property.tPnn50 / results.length,
          s1: property.tS1 / results.length,
          s2: property.tS2 / results.length,
          total: results.length
        }

        setMedianProperty(median);
        console.log(median)
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };


  const calculateDailyMetrics = (logs, CollectionHR) => {
    console.log('HR', logs)
    const groupedLogs = logs.reduce((acc, log) => {
      const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      // let dfaHR = logs.map(log => log.HR);
      // let dfa = calculateDFA(CollectionHR);
      // let dfa = logs.map(log => log.HR);
      // console.log('dfa: ', dfa)
      acc[date].push({ ...log });
      return acc;
    }, {});

    // Add DFA value here..
    console.log(groupedLogs)

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
      console.log(HRPoint, dfa);
      // console.log(groupedLogs[date], i)
      const metrics = calculateMetrics(groupedLogs[date]);
      return { date, ...metrics, dfa };
    });

    // const dfa = logs.map((log) => log.RR);
    // const dfaResult = calculateDFA(dfa);

    setDailyMetrics(dailyMetrics);
  };

  const toggleVisibilityHR = () => setHRIsVisible(!isHRVisible);
  const toggleVisibilityRR = () => setRRIsVisible(!isRRVisible);
  const toggleVisibilityPoincare = () => setPoincareIsVisible(!isPoincareVisible);

  const formatDate = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
    return date.toLocaleString(); // Adjust the format as needed
  };

  const chartData = (label, dataKey) => ({
    labels: logs ? logs.map(item => formatDate(item.timestamp)).reverse() : [],
    datasets: [
      {
        label,
        data: logs ? logs.map(item => item[dataKey]).reverse() : [],
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        fill: true,
      },
    ],
  });

  const poincareData = () => {
    if (!logs) return { datasets: [] };

    const rr = logs.map(item => item.RR);
    const data = rr.slice(1).map((value, index) => ({
      x: rr[index],
      y: value,
    }));

    return {
      datasets: [
        {
          label: 'Poincare Plot',
          data,
          backgroundColor: 'rgba(75, 192, 192, 1)',
          pointRadius: 2,
        },
      ],
    };
  };

  const handleChangeDevice = (e) => {
    e.preventDefault();
    setDevice(e.target.value);
    fetchLogs(e.target.value);
  }

  const calculateQuartilesAndIQR = (values) => {
    values.sort((a, b) => a - b);
    const midIndex = Math.floor(values.length / 2);
    const Q1 = values[Math.floor(midIndex / 2)];
    const Q3 = values[Math.floor(midIndex + midIndex / 2)];
    const IQR = Q3 - Q1;
    return { Q1, Q3, IQR };
  }

  const handleDfaAvg = () => {
    let result = 0;
    let dfaValues = dailyMetrics.map(val => val.dfa);
    dfaValues.forEach(val => {
      result += val
    });
    // console.log(dfaValues, result)
    result = result / dfaValues.length;
    return result.toFixed(2);
  }

  return (
    <div>
      <main>
        <section className="bg-white flex">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bg-white w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <div className="relative w-full px-4 max-w-full flex-grow flex-1 flex justify-betwee">
                    {currentUser.role == 'user' ? (
                      <h3 className="font-semibold text-base text-blueGray-700">Monitoring || Device {currentUser.role == 'user' ? currentUser.current_device : DocterPatient.current_device} </h3>

                    ) : (
                      <div className="flex justify-between items-center w-full">

                        <h3 className="font-semibold text-base text-blueGray-700">Monitoring || Device {device ?? 'nothing'} </h3>
                        <select name="" id="" className='border border-slate-200 rounded-md px-3 py-1' onChange={handleChangeDevice}>
                          <option value="" selected disabled>Select device Monitoring</option>
                          <option value="C0680226">C0680226</option>
                          <option value="BA903328">BA903328</option>

                        </select>

                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-8">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Daily Metrics</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDNN</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMSSD</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pNN50</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S1</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S2</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyMetrics.length > 0 ? (
                        dailyMetrics.map((metric, index) => {
                          return (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.date}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.sdnn !== null ? metric.sdnn.toFixed(2) : 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.rmssd !== null ? metric.rmssd.toFixed(2) : 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.pnn50 !== null ? metric.pnn50.toFixed(2) : 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.s1 !== null ? metric.s1.toFixed(2) : 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.s2 !== null ? metric.s2.toFixed(2) : 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{metric.dfa !== null ? metric.dfa.toFixed(2) : 'N/A'}</td>
                            </tr>
                          );
                        })

                      ) : null}

                    </tbody>
                  </table>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2 mt-4">Average Metrics</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDNN</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMSSD</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pNN50</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S1</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S2</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {/* {dailyMetrics.map((metric, index) => ( */}
                      {dailyMetrics.length > 0 ? (


                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">{dailyMetrics[dailyMetrics.length - 1]['date']} - {dailyMetrics[0]['date']} </td>
                          <td className="px-6 py-4 whitespace-nowrap">{medianProperty.sdnn.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{medianProperty.rmssd.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{medianProperty.pnn50.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{medianProperty.s1.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{medianProperty.s2.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{handleDfaAvg()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{medianProperty.total}</td>
                        </tr>


                      ) : null}
                      {/* ))} */}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Select Date Range</h4>
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
                    className="p-2 border border-gray-300 rounded"
                  />
                  {loading ? (
                    <span class="ms-4 loader"></span>
                  ) : null}
                  {/* <span className='ms-2'>Loading..</span> */}
                </div>
              </div>
            </div>
            <div className="inline-flex items-center rounded-md shadow-sm mt-4">
              <ToggleButton text="RR" isVisible={isRRVisible} onClick={toggleVisibilityRR} />
              <ToggleButton text="HR" isVisible={isHRVisible} onClick={toggleVisibilityHR} />
              <ToggleButton text="Poincare" isVisible={isPoincareVisible} onClick={toggleVisibilityPoincare} />
            </div>
            <div className="mt-4 lg:flex lg:items-center">
              {isHRVisible && <ChartComponent data={chartData('HR', 'HR')} />}
            </div>
            <div className="mt-4 lg:flex lg:items-center">
              {isRRVisible && <ChartComponent data={chartData('RR', 'RR')} />}
            </div>
            <div className="mt-4 lg:flex lg:items-center">
              {isPoincareVisible && <ScatterChartComponent data={poincareData()} />}
            </div>
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

const ChartComponent = ({ data }) => (
  <div className="object-cover w-full lg:w-full rounded-xl h-96">
    <Line data={data} />
  </div>
);

const ScatterChartComponent = ({ data }) => (
  <div className="object-cover w-full lg:w-full rounded-xl h-96">
    <Scatter data={data} />
  </div>
);
