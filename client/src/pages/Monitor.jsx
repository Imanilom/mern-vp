import React, { useEffect, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../components/Side";

export default function Monitor() {
  const { currentUser } = useSelector((state) => state.user);
  const [log, setLog] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [metrics, setMetrics] = useState({ rmssd: null, pnn50: null, sdnn: null });

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs();
    }
  }, [startDate, endDate]);

  const fetchLogs = async () => {
    try {
      let url = `/api/user/test`;
      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setLog(data.logs);

      if (data && data.logs.length > 0) {
        setMetrics(data.calculate);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const [isHRVisible, setHRIsVisible] = useState(false);
  const [isRRVisible, setRRIsVisible] = useState(false);
  const [isPoincareVisible, setPoincareIsVisible] = useState(false);

  const toggleVisibilityHR = () => setHRIsVisible(!isHRVisible);
  const toggleVisibilityRR = () => setRRIsVisible(!isRRVisible);
  const toggleVisibilityPoincare = () => setPoincareIsVisible(!isPoincareVisible);

  const chartData = (label, dataKey) => ({
    labels: log ? log.map(item => item.time_created) : [],
    datasets: [
      {
        label,
        data: log ? log.map(item => item[dataKey]) : [],
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        fill: false,
      },
    ],
  });

  const poincareData = () => {
    if (!log) return { datasets: [] };

    const rr = log.map(item => item.RR);
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

  return (
    <div>
      <main>
        <section className="bg-white flex">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bg-white w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <div className="relative w-full px-4 max-w-full flex-grow flex-1">
                    <h3 className="font-semibold text-base text-blueGray-700">Monitoring</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <MetricCard title="SDNN" value={metrics.sdnn} />
                  <MetricCard title="RMSSD" value={metrics.rmssd} />
                  <MetricCard title="pNN50" value={metrics.pnn50} />
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

const MetricCard = ({ title, value }) => (
  <div className="bg-white shadow-md rounded-lg p-4">
    <h4 className="text-lg font-semibold text-gray-800 mb-2">{title}</h4>
    <p className="text-gray-600">{value !== null ? value.toFixed(2) : "Loading..."}</p>
  </div>
);

const ToggleButton = ({ text, isVisible, onClick }) => (
  <button
    className={`text-slate-800 hover:text-blue-600 text-sm bg-white hover:bg-slate-100 border ${
      isVisible ? 'border-slate-200' : ''
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
