import React, { useEffect, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";

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
  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs();
    }
  }, [startDate, endDate]);

  const fetchLogs = async (device) => {
    try {
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
      const sortedLogs = data.logs.sort((a, b) => b.timestamp - a.timestamp); // Sort logs from newest to oldest
      setLogs(sortedLogs);

      if (data && sortedLogs.length > 0) {
        setMetrics(calculateMetrics(sortedLogs));
        calculateDailyMetrics(sortedLogs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const calculateDailyMetrics = (logs) => {
    const groupedLogs = logs.reduce((acc, log) => {
      const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    }, {});

    const dailyMetrics = Object.keys(groupedLogs).map(date => {
      const metrics = calculateMetrics(groupedLogs[date]);
      return { date, ...metrics };
    });

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
    fetchLogs(e.target.value)
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyMetrics.map((metric, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">{metric.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{metric.sdnn !== null ? metric.sdnn.toFixed(2) : 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{metric.rmssd !== null ? metric.rmssd.toFixed(2) : 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{metric.pnn50 !== null ? metric.pnn50.toFixed(2) : 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{metric.s1 !== null ? metric.s1.toFixed(2) : 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{metric.s2 !== null ? metric.s2.toFixed(2) : 'N/A'}</td>
                        </tr>
                      ))}
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
                      setStartDate(start);
                      setEndDate(end);
                    }}
                    isClearable
                    className="p-2 border border-gray-300 rounded"
                  />
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
