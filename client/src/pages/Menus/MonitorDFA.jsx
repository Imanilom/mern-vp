import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';
import '../../loading.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import AOS from 'aos';
import LineGraph from '../../components/LineGraphDFA';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';


let results = []

export default function MonitorDFA() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const [logs, setLogs] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [isDFAGraphVisible, setDfaGraphVisible] = useState(false);
  const [isADFAGraphVisible, setADfaGraphVisible] = useState(false);
  const [device, setDevice] = useState("C0680226");
  const [metode, setMetode] = useState("Kalman");
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [tableadfa, setTableadfa] = useState([]);
  const [borderColor, setBorderColor] = useState([]);
  const [resultsDFA, setResults] = useState([]);
  const [resultsDFA2, setResults2] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [current, setCurrent] = useState(1);
  const itemsPerPage = 10;


  // Jika input date range berubah, jalankan fungsi dibwh
  useEffect(() => {
  
    if (startDate && endDate) {
      fetchLogs(device);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    // Mengecek apakah user memiliki guid yang valid
    if (currentUser.guid == '' || !currentUser.guid) {
      setLoading(true);
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => {
        // tendang ke profile untuk mengisi guid
        return navigate('/profile');
      });
    } else {
      // Panggil AOS untuk scrool animation
      AOS.init({
        duration: 700
      })

      fetchLogs(device); // run function
    }
  }, []);

  const fetchLogs = async (device, metode) => {
    try {
      setLoading(true); // tampilkan halaman loading

      results = [];

      // Fetching API
      let url = `/api/user/logdfa`;
      if (device) {
        url = `/api/user/logdfa`;
      }

      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        if (metode) url += `&method=${metode}`;
      } else {
        if (metode) url += `?method=${metode}`;
      }

      const response = await fetch(url);
   
      const data = await response.json();

      const tableData = processData(data);
      const tableadfa = processadfa(data);
      const graphData = graph(data);


      
    
      
    
      setTableData(tableData);
      setTableadfa(tableadfa);
      setGraphData(graphData);

      if (!response.ok) {
        // Jika terjadi kesalahan, hentikan dan set semua variabel ke default
        setLogs([]);
        setDailyMetrics([]);
        setResults([]);
        setResults2([]);
        dispatch(clearLogsWithDailytMetric());
        return
      }
    
      // urutkan berdasarakna date
      let sortedResult = data.result.sort((a, b) => a.timestamp_tanggal - b.timestamp_tanggal);
      
      setResults(sortedResult); // menampung data untuk table
      setResults2(sortedResult); // menampung data untuk grafik

    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const graph = (data) => {
    const graphData = [];

    data.result.forEach((entry) => {
      const { date, activityMetrics } = entry;

      // Iterasi aktivitas
      Object.entries(activityMetrics).forEach(([activity, metricsArray]) => {
        metricsArray.forEach(({ metrics, timestamps }) => {
          const { dfa } = metrics || {};
          const { start, end } = timestamps || {};

          graphData.push({
            activity,
            date,
            start,
            end,
            alpha1: dfa?.alpha1 || null,
            alpha2: dfa?.alpha2 || null,
            status: getStatus(dfa?.alpha1, dfa?.alpha2),
          });
        });
      });
    });

    return graphData;
  };

  const processData = (data) => {
    const tableData = [];

    data.result.forEach((entry) => {
      const { date, activityMetrics } = entry;

      // Iterasi aktivitas
      Object.entries(activityMetrics).forEach(([activity, metricsArray]) => {
        metricsArray.forEach(({ metrics, timestamps }) => {
          const { dfa } = metrics || {};
          const { start, end } = timestamps || {};

          tableData.push({
            activity,
            date,
            start,
            end,
            alpha1: dfa?.alpha1 || null,
            alpha2: dfa?.alpha2 || null,
            status: getStatus(dfa?.alpha1, dfa?.alpha2),
          });
        });
      });
    });

    return tableData;
  };


  const getStatus = (alpha1, alpha2) => {
    if (alpha1 === null || alpha2 === null) return "tidak ada";
    if (alpha1 >= 1.5 || alpha2 >= 1.5) return "danger";
    if (alpha1 >= 1.2 || alpha2 >= 1.2) return "warning";
    return "safe";
  };


  const processadfa = (data) => {
    const tableadfa = [];
  
    data.result.forEach((entry) => {
      const { date, activityMetrics } = entry;

      // Iterasi aktivitas
      Object.entries(activityMetrics).forEach(([activity, metricsArray]) => {
        metricsArray.forEach(({ metrics, timestamps }) => {
          const { adfa } = metrics || {};
          const { start, end } = timestamps || {};

          tableData.push({
            activity,
            date,
            start,
            end,
            alphaPlus: adfa?.alphaPlus || null,
            alphaMinus: adfa?.alphaMinus || null,
          });
        });
      });
    });

    return tableadfa;
  };

  const currentData = tableData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(tableData.length / itemsPerPage);

  const currentadfa = tableadfa.slice(
    (current - 1) * itemsPerPage,
    current * itemsPerPage
  );

  const totalPagesadfa = Math.ceil(tableData.length / itemsPerPage);

  
  // Handle Change Metode
  const handleChangeMetode = (e) => {
    e.preventDefault(); // Menghindari web dimuat ulang
    setMetode(e.target.value);
    fetchLogs(device, e.target.value); // run function
  }

  const getStatusColor = (alpha1, alpha2) => {
    const status = getStatus(alpha1, alpha2); // Assuming getStatus() returns 'safe', 'warning', or 'danger'
    if (status === 'safe') {
      return 'rgba(0, 255, 0, 1)'; // Green for safe
    } else if (status === 'warning') {
      return 'rgba(255, 165, 0, 1)'; // Orange for warning
    } else {
      return 'rgba(255, 0, 0, 1)'; // Red for danger
    }
  };

  const chartData = {
    labels: graphData.map(item => item.start),  // Formatting timestamps as time
    datasets: [
      {
        label: 'Alpha 1',
        data: graphData.map(item => item.alpha1),
        borderColor: 'rgba(75, 192, 192, 1)', // Distinct color for alpha1
        backgroundColor: graphData.map(item => getStatusColor(item.alpha1, item.alpha2)), // Dynamic color based on status
        fill: false,
      },
      {
        label: 'Alpha 2',
        data: graphData.map(item => item.alpha2),
        borderColor: 'rgba(255, 99, 132, 1)', // Distinct color for alpha2
        backgroundColor: graphData.map(item => getStatusColor(item.alpha1, item.alpha2)), // Dynamic color based on status
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(tooltipItem) {
            const index = tooltipItem.dataIndex;
            const activity = graphData[index].activity; // Get the activity for the hovered point
            const value = tooltipItem.raw; // The value of alpha1 or alpha2
            return `${activity}: ${value}`; // Display activity name and value
          }
        }
      }
    }
  };
  
  
  
  
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
        <section className="bg-[#101010] dark:bg-[#FEFCF5] flex text-white  dark:text-[#073B4C]">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 pb-8 xl:mb-0 px-4 mx-auto mt-5">
            <div className=" flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  {/* <ButtonOffCanvas index={2} /> */}

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
                  className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded text-sm lg:me-0 me-3 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
                />

                <select
                  name=""
                  id=""
                  className="lg:p-2.5 p-3 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] md:max-w-[200px] rounded text-sm w-full  md:text-[16px] lg:min-w-[220px] px-3 py-3"
                  onChange={handleChangeMetode}
                >
                  {/* <option value="" disabled selected>Choose metode</option> */}
                  <option value="IQ">IQ</option>
                  <option value="Kalman">Kalman</option>
                             <option value="BC">Box Cox</option>
                  <option value="OC">One Class SVM</option>
                </select>

                <table className="min-w-full mt-5 border-collapse border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <thead className='bg-gray-300 text-gray-700'>
                    <tr className="bg-gray-200">
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Tanggal</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Waktu Mulai</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Waktu Selesai</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Aktivitas</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Alpha 1</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Alpha 2</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Status</th>
                    </tr>
                  </thead>
                    <tbody className="bg-gray-200 divide-y divide-gray-200">
                    {currentData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition duration-200">
                            <td className="px-6 py-4 text-sm text-gray-800">{row.date}</td>
                            <td className="px-6 py-4 text-sm text-gray-800">{row.start}</td>
                            <td className="px-6 py-4 text-sm text-gray-800">{row.end}</td>
                            <td className="px-6 py-4 text-sm text-gray-800">{row.activity}</td>
                            <td className="px-6 py-4 text-sm text-gray-800">
                              {row.alpha1 !== null ? (
                                  row.alpha1.toFixed(2)
                              ) : (
                                  <span className="px-3 py-1 rounded-full bg-gray-400 text-white font-medium">
                                      properti kosong
                                  </span>
                              )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800">
                              {row.alpha2 !== null ? (
                                  row.alpha2.toFixed(2)
                              ) : (
                                  <span className="px-3 py-1 rounded-full bg-gray-400 text-white font-medium">
                                      properti kosong
                                  </span>
                              )}
                          </td>

                            <td className="px-6 py-4 text-sm text-gray-800">
                                <span
                                    className={`px-3 py-1 rounded-full text-white font-medium ${
                                        row.status === "safe"
                                            ? "bg-green-500"
                                            : row.status === "warning"
                                            ? "bg-orange-500"
                                            : row.status === "danger"
                                            ? "bg-red-500"
                                            : "bg-gray-400"
                                    }`}
                                >
                                    {row.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>

                </table>

                <div className="flex justify-between items-center mt-4">
                  <button
                    className="px-4 py-2 border rounded"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPagesadfa}
                  </span>
                  <button
                    className="px-4 py-2 border rounded"
                    disabled={currentPage === totalPagesadfa}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>

                <br />

                {/* <table className="min-w-full mt-5 border-collapse border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <thead className='bg-gray-300 text-gray-700'>
                    <tr className="bg-gray-200">
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Tanggal</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Waktu Mulai</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Waktu Selesai</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Aktivitas</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Alpha Plus</th>
                      <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider border-b">Alpha Minus</th>
                    </tr>
                  </thead>
                  <tbody className='bg-gray-200 divide-y divide-gray-200'>
                    {currentadfa.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition duration-200">
                        <td className="px-6 py-4 text-sm text-gray-800">{row.date}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">{row.start}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">{row.end}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">{row.activity}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">{row.alphaPlus}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">{row.alphaMinus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table> */}

                {/* <div className="flex justify-between items-center mt-4">
                  <button
                    className="px-4 py-2 border rounded"
                    disabled={current === 1}
                    onClick={() => setCurrent(current - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {current} of {totalPages}
                  </span>
                  <button
                    className="px-4 py-2 border rounded"
                    disabled={current === totalPages}
                    onClick={() => setCurrent(current + 1)}
                  >
                    Next
                  </button>
                </div> */}

                


              </div>
            </div>

            

            <div onClick={() => setDfaGraphVisible(!isDFAGraphVisible)} className={isDFAGraphVisible && resultsDFA2.length > 0 ? `border-transparent mb-3 bg-[#07AC7B] rounded-md flex mx-4 cursor-pointer dark:bg-[#101010]/10` : `mb-3 cursor-pointer border border-gray-400 rounded-md flex mx-4 dark:bg-[#101010]/10`}>
              <button className='text-xs py-0.5 px-1.5 m-2'>{isDFAGraphVisible ? 'Hide' : 'Show'} Graphic DFA</button>
            </div>
            {isDFAGraphVisible && resultsDFA2.length > 0 ? (
               <Line data={chartData} options={options} />


            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

