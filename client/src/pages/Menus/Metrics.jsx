import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import AOS from 'aos';
import '../../loading.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';

export default function Metrics() {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState(null);
  const [activityMetrics, setActivityMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState("C0680226");
  const [metode, setMetode] = useState("Kalman");

  useEffect(() => {
    if (!currentUser?.guid) {
      setLoading(true);
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => navigate('/profile'));
    } else {
      AOS.init({ duration: 700 });
      fetchLogs(device, metode);
    }
  }, []);

  const fetchLogs = async (device, metode) => {
    try {
      setLoading(true);
      let url = `/api/user/metrics/${device || ''}`;
      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        if (metode) url += `&method=${metode}`;
      } else {
        if (metode) url += `?method=${metode}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.dailyMetrics) {
        dispatch(clearLogsWithDailytMetric());
        setDailyMetrics(null);
        setActivityMetrics({});
      } else {
        setDailyMetrics(data.dailyMetrics);
        setActivityMetrics(data.activityMetrics || {});
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs(device, metode);
    }
  }, [startDate, endDate]);

  const handleChangeMetode = (e) => {
    setMetode(e.target.value);
    fetchLogs(device, e.target.value);
  };

  const formatDecimal = (value) => (value ? value.toFixed(2) : 'N/A');
  return (
    <div>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101010] dark:bg-[#FEFCF5]">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[#07AC7B] dark:border-[#217170] rounded-full animate-spin"></div>
            <p className="text-center font-semibold mt-4 text-[#07AC7B] dark:text-[#217170]">Loading...</p>
          </div>
        </div>
      )}
      <main>
        <section className="bg-[#101010] dark:bg-[#FEFCF5] flex text-white dark:text-[#073B4C]">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <h1 className="text-3xl font-semibold capitalize lg:text-4xl" data-aos="fade-up">Metrics Data</h1>
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
                  placeholderText="Cari berdasarkan range tanggal"
                  className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded mr-6 text-sm"
                />
                <select
                  onChange={handleChangeMetode}
                  className="lg:p-2.5 p-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm"
                >
                  <option value="" disabled selected>Choose metode</option>
                  <option value="IQ">IQ</option>
                  <option value="Kalman">Kalman</option>
                </select>
              </div>
              <div className="mt-6 overflow-x-auto max-w-full">
  <h2 className="text-xl font-bold mb-4">Daily Metrics</h2>
  {dailyMetrics && Array.isArray(dailyMetrics) && dailyMetrics.length > 0 ? (
    <table className="min-w-full table-auto border-collapse border border-gray-200 mb-8">
      <thead>
        <tr>
          <th className="border border-gray-300 px-4 py-5" style={{ width: '200px' }}>Date</th>
          <th className="border border-gray-300 px-4 py-2">DFA Alpha 1</th>
          <th className="border border-gray-300 px-4 py-2">DFA Alpha 2</th>
          <th className="border border-gray-300 px-4 py-2">ADFA Alpha Plus</th>
          <th className="border border-gray-300 px-4 py-2">ADFA Alpha Minus</th>
          <th className="border border-gray-300 px-4 py-2">Median 3DP</th>
          <th className="border border-gray-300 px-4 py-2">Mean</th>
          <th className="border border-gray-300 px-4 py-2">Max</th>
          <th className="border border-gray-300 px-4 py-2">Min</th>
          <th className="border border-gray-300 px-4 py-2">RMSSD</th>
          <th className="border border-gray-300 px-4 py-2">SDNN</th>
          <th className="border border-gray-300 px-4 py-2">HF</th>
          <th className="border border-gray-300 px-4 py-2">LF</th>
          <th className="border border-gray-300 px-4 py-2">LF/HF Ratio</th>
          <th className="border border-gray-300 px-4 py-2">S1</th>
          <th className="border border-gray-300 px-4 py-2">S2</th>
        </tr>
      </thead>
      <tbody>
        {dailyMetrics.map((metric, index) => (
          <tr key={index}>
            <td className="border border-gray-300 px-4 py-2">{metric.date || 'N/A'}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.dfa?.alpha1)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.dfa?.alpha2)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.adfa?.alphaPlus)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.adfa?.alphaMinus)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.median3dp)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.mean)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.max)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.min)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.rmssd)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.sdnn)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.hf)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.lf)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.lfHfRatio)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.s1)}</td>
            <td className="border border-gray-300 px-4 py-2">{formatDecimal(metric.s2)}</td>

          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className="text-center">No data available for the selected date range.</p>
  )}
</div>

            </div>
          </div>
        </section>
      </main>
    </div>
  );
}