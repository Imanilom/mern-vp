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

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

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
  }, [currentUser, device, metode, navigate]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs(device, metode);
    }
  }, [startDate, endDate]);

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
      console.log(data)
      if (!response.ok || !data.dailyMetrics) {
        dispatch(clearLogsWithDailytMetric());
        setDailyMetrics(null);
        setActivityMetrics({});
      } else {
        setDailyMetrics(data.dailyMetrics);
        setActivityMetrics(data.activityMetrics);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeMetode = (e) => {
    setMetode(e.target.value);
    fetchLogs(device, e.target.value);
  };

  const formatDecimal = (value) => (value ? value.toFixed(2) : 'N/A');

  const activityMetricsArray = Object.entries(activityMetrics).flatMap(([key, value]) => {
    return Object.keys(value).map(subKey => ({
      activity: subKey,
      ...value[subKey]
    }));
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = activityMetricsArray.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (direction) => {
    if (direction === "next" && currentPage < Math.ceil(activityMetricsArray.length / itemsPerPage)) {
      setCurrentPage(currentPage + 1);
    } else if (direction === "prev" && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

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
                  <option value="BC">Box Cox</option>
                  <option value="OC">One Class SVM</option>
                </select>
              </div>
              <div className="mt-6 overflow-x-auto max-w-full">
                <h2 className="text-xl font-bold mb-4">Daily Metrics</h2>
                {dailyMetrics && Array.isArray(dailyMetrics) && dailyMetrics.length > 0 ? (
                  <table className="min-w-full mt-5 border-collapse border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    <thead className='bg-gray-300 text-gray-700'>
                      <tr className='bg-gray-200'>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">DFA Alpha 1</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">DFA Alpha 2</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">ADFA Alpha Plus</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">ADFA Alpha Minus</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Median 3DP</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Mean</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Max</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Min</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">RMSSD</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">SDNN</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">HF</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">LF</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">LF/HF Ratio</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">S1</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">S2</th>
                      </tr>
                    </thead>
                    <tbody className='bg-gray-200 divide-y divide-gray-200'>
                      {dailyMetrics.map((metric, index) => (
                        <tr key={index} className='hover:bg-gray-50 transition duration-200'>
                          <td className="px-6 py-4 text-sm text-gray-800">{metric.date || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.dfa?.alpha1)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.dfa?.alpha2)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.adfa?.alphaPlus)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.adfa?.alphaMinus)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.median3dp)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.mean)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.max)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.min)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.rmssd)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.sdnn)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.hf)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.lf)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.lfHfRatio)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.s1)}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{formatDecimal(metric.s2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center">No data available for the selected date range.</p>
                )}
              </div>

              <div className="mt-6 overflow-x-auto max-w-full">
                <h2 className="text-xl font-bold mb-4">Activity Metrics</h2>
                {activityMetricsArray.length > 0 ? (
                  <>
                    <table className="min-w-full mt-5 border-collapse border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      <thead className="bg-gray-300 text-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">
                            Activity
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">
                            Start Time
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">
                            End Time
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">
                            Metrics
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-200 divide-y divide-gray-200">
                        {currentItems.map((activity, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition duration-200">
                            <td className="px-6 py-4 text-sm text-gray-800">{activity.activity || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-800">
                              {activity.timestamps?.start || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-800">
                              {activity.timestamps?.end || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-800">
                              {activity.metrics ? (
                                <table className="table-auto border-collapse border border-gray-300 w-full text-left text-sm">
                                  <thead>
                                    <tr>
                                      <th className="border border-gray-300 px-2 py-1 bg-gray-100">Metric</th>
                                      <th className="border border-gray-300 px-2 py-1 bg-gray-100">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(activity.metrics).map(([metricName, value]) => (
                                      typeof value === "object" && value !== null ? (
                                        // Render sub-metrics sebagai tabel nested
                                        <tr key={metricName}>
                                          <td className="border border-gray-300 px-2 py-1 font-bold" colSpan={2}>
                                            {metricName}
                                            <table className="table-auto border-collapse border border-gray-300 w-full mt-2">
                                              <thead>
                                                <tr>
                                                  <th className="border border-gray-300 px-2 py-1 bg-gray-100">Sub-Metric</th>
                                                  <th className="border border-gray-300 px-2 py-1 bg-gray-100">Value</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {Object.entries(value).map(([subMetricName, subValue]) => (
                                                  <tr key={subMetricName}>
                                                    <td className="border border-gray-300 px-2 py-1">{subMetricName}</td>
                                                    <td className="border border-gray-300 px-2 py-1">
                                                      {subValue !== null ? subValue : "N/A"}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </td>
                                        </tr>
                                      ) : (
                                        // Render metric biasa
                                        <tr key={metricName}>
                                          <td className="border border-gray-300 px-2 py-1">{metricName}</td>
                                          <td className="border border-gray-300 px-2 py-1">
                                            {value !== null ? value : "N/A"}
                                          </td>
                                        </tr>
                                      )
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                "No metrics available"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 flex justify-between">
                      <button
                        onClick={() => handlePageChange("prev")}
                        disabled={currentPage === 1}
                        className="p-2 bg-gray-200 rounded"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange("next")}
                        disabled={currentPage === Math.ceil(activityMetricsArray.length / itemsPerPage)}
                        className="p-2 bg-gray-200 rounded"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-center">No activity data available for the selected date range.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}