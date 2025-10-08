import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';
import '../../loading.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import AOS from 'aos';
import { Line, Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';

// Register additional ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function MonitorDFA() {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.user);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [device] = useState("C0680226");
  const [metode, setMetode] = useState("Kalman");
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [activeGraphs, setActiveGraphs] = useState({
    alpha1: false,
    alpha2: false,
    combined: false,
    statusDistribution: false
  });

  // Memoized calculations for better performance
  const { currentData, totalPages } = useMemo(() => {
    const total = Math.ceil(tableData.length / itemsPerPage);
    const data = tableData.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
    return { currentData: data, totalPages: total };
  }, [tableData, currentPage]);

  const statusCounts = useMemo(() => {
    return tableData.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }, [tableData]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs(device);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (currentUser.guid === '' || !currentUser.guid) {
      setLoading(true);
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. Akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => {
        return navigate('/profile');
      });
    } else {
      AOS.init({ duration: 700 });
      fetchLogs(device);
    }
  }, []);

  const fetchLogs = async (device, metode) => {
    try {
      setLoading(true);

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
      const graphData = processAlpha2DailyData(data);

      setTableData(tableData);
      setGraphData(graphData);

      if (!response.ok) {
        dispatch(clearLogsWithDailytMetric());
        return;
      }

    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hapus sorting di processData
const processData = (data) => {
  const tableData = [];

  data.result.forEach((entry) => {
    const { date, activityMetrics } = entry;

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

  return tableData; // Tidak perlu sorting di sini
};

// Hapus sorting di processAlpha2DailyData
const processAlpha2DailyData = (data) => {
  const dailyData = [];

  data.result.forEach((entry) => {
    const { date, activityMetrics } = entry;

    Object.entries(activityMetrics).forEach(([activity, metricsArray]) => {
      metricsArray.forEach(({ metrics, timestamps }) => {
        const { dfa } = metrics || {};
        const { start, end } = timestamps || {};

        if (dfa?.alpha2 !== null && dfa?.alpha2 !== undefined) {
          dailyData.push({
            date,
            start,
            end,
            activity,
            alpha2: dfa.alpha2,
            status: getStatus(null, dfa.alpha2)
          });
        }
      });
    });
  });

  return dailyData; // Tidak perlu sorting di sini
};

  const getStatus = (alpha1, alpha2) => {
    if (alpha1 === null && alpha2 === null) return "tidak ada";
    const value = alpha2 !== null ? alpha2 : alpha1;
    if (value >= 1.5) return "danger";
    if (value >= 1.2) return "warning";
    return "safe";
  };

  const getStatusColor = (value, isAlpha2 = false) => {
    const status = getStatus(isAlpha2 ? null : value, isAlpha2 ? value : null);
    if (status === 'safe') return 'rgba(75, 192, 192, 0.7)';
    if (status === 'warning') return 'rgba(255, 159, 64, 0.7)';
    return 'rgba(255, 99, 132, 0.7)';
  };

const alpha1ChartData = {
  labels: [...tableData].reverse().map(item => `${item.date} ${item.start}`), // Balikkan urutan
  datasets: [
    {
      label: 'Alpha 1 per Aktivitas',
      data: [...tableData].reverse().map(item => item.alpha1), // Balikkan urutan
      borderColor: 'rgba(0, 0, 0, 1)',
      backgroundColor: [...tableData].reverse().map(item => getStatusColor(item.alpha1)), // Balikkan urutan
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: {
        target: 'origin',
        above: 'rgba(75, 192, 192, 0.2)',
        below: 'rgba(255, 99, 132, 0.2)'
      }
    }
  ],
};

const alpha2ChartData = {
  labels: [...graphData].reverse().map(item => `${item.date} ${item.start}`), // Balikkan urutan
  datasets: [
    {
      label: 'Alpha 2 Harian',
      data: [...graphData].reverse().map(item => item.alpha2), // Balikkan urutan
      borderColor: 'rgba(18, 15, 15, 1)',
      backgroundColor: [...graphData].reverse().map(item => getStatusColor(item.alpha2, true)), // Balikkan urutan
      borderWidth: 1,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: true
    }
  ],
};

const combinedChartData = {
  labels: [...tableData].reverse().map(item => `${item.date} ${item.start}`), // Balikkan urutan
  datasets: [
    {
      label: 'Alpha 1',
      data: [...tableData].reverse().map(item => item.alpha1), // Balikkan urutan
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderWidth: 2,
      tension: 0.3,
      yAxisID: 'y'
    },
    {
      label: 'Alpha 2',
      data: [...tableData].reverse().map(item => item.alpha2), // Balikkan urutan
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderWidth: 2,
      tension: 0.3,
      yAxisID: 'y'
    }
  ]
};

  const statusDistributionData = {
    labels: ['Safe', 'Warning', 'Danger'],
    datasets: [
      {
        label: 'Status Distribution',
        data: [
          statusCounts.safe || 0,
          statusCounts.warning || 0,
          statusCounts.danger || 0
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 159, 64, 0.7)',
          'rgba(255, 99, 132, 0.7)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const index = context.dataIndex;
            let label = context.dataset.label || '';
            let activity, timeRange;
            
            if (context.dataset.label.includes('Alpha 1')) {
              activity = tableData[index].activity;
              timeRange = `${tableData[index].start} - ${tableData[index].end}`;
              return [
                `${label}: ${context.parsed.y?.toFixed(2) || 'N/A'}`,
                `Aktivitas: ${activity}`,
                `Waktu: ${timeRange}`
              ];
            } else if (context.dataset.label.includes('Alpha 2')) {
              activity = graphData[index]?.activity || tableData[index]?.activity;
              timeRange = graphData[index] ? 
                `${graphData[index].start} - ${graphData[index].end}` : 
                `${tableData[index].start} - ${tableData[index].end}`;
              return [
                `${label}: ${context.parsed.y?.toFixed(2) || 'N/A'}`,
                `Aktivitas: ${activity}`,
                `Waktu: ${timeRange}`,
                `Tanggal: ${graphData[index]?.date || tableData[index]?.date}`
              ];
            } else {
              return `${label}: ${context.parsed.y}`;
            }
          },
          afterLabel: function(context) {
            const index = context.dataIndex;
            let status;
            if (context.dataset.label.includes('Alpha 1')) {
              status = tableData[index]?.status;
            } else if (context.dataset.label.includes('Alpha 2')) {
              status = graphData[index]?.status;
            }
            return status ? `Status: ${status}` : '';
          }
        }
      },
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12
          },
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'DFA Monitoring',
        font: {
          size: 16
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 2,
        ticks: {
          stepSize: 0.2
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  const statusDistributionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Status Distribution',
        font: {
          size: 16
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  const handleChangeMetode = (e) => {
    e.preventDefault();
    setMetode(e.target.value);
    fetchLogs(device, e.target.value);
  };

  const toggleGraph = (graphName) => {
    setActiveGraphs(prev => ({
      ...prev,
      [graphName]: !prev[graphName]
    }));
  };

  return (
    <div className="min-h-screen">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101010] dark:bg-[#FEFCF5]">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[#07AC7B] dark:border-[#217170] rounded-full animate-spin" style={{ animationDuration: '0.5s' }}></div>
            <p className="text-center font-semibold mt-4 text-[#07AC7B] dark:text-[#217170]">
              Loading...
            </p>
          </div>
        </div>
      )}
      
      <main>
        <section className="bg-[#101010] dark:bg-[#FEFCF5] flex text-white dark:text-[#073B4C]">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 pb-8 xl:mb-0 px-4 mx-auto mt-5">
            <div className="flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <h1 data-aos="fade-up" className="text-3xl font-semibold capitalize lg:text-4xl">Monitoring DFA</h1>
                
                <div className="flex flex-wrap items-center mt-3 gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <DatePicker
                      selectsRange
                      startDate={startDate}
                      endDate={endDate}
                      onChange={([start, end]) => {
                        setStartDate(start);
                        setEndDate(end);
                      }}
                      isClearable
                      placeholderText='Pilih rentang tanggal'
                      className="lg:p-2.5 p-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm md:text-[16px] w-full"
                      dateFormat="dd/MM/yyyy"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={metode}
                      onChange={handleChangeMetode}
                      className="lg:p-2.5 p-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm md:text-[16px] w-full"
                    >
                      <option value="IQ">IQ</option>
                      <option value="Kalman">Kalman</option>
                      <option value="BC">Box Cox</option>
                      <option value="OC">One Class SVM</option>
                    </select>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                  <div className="bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-400 dark:text-gray-600">Total Data</h3>
                    <p className="text-2xl font-bold">{tableData.length}</p>
                  </div>
                  <div className="bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-400 dark:text-gray-600">Safe Status</h3>
                    <p className="text-2xl font-bold text-green-500">{statusCounts.safe || 0}</p>
                  </div>
                  <div className="bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-400 dark:text-gray-600">Warning/Danger</h3>
                    <p className="text-2xl font-bold text-orange-500">
                      {(statusCounts.warning || 0) + (statusCounts.danger || 0)}
                    </p>
                  </div>
                </div>

                {/* Tabel Data */}
                <div className="mt-5 overflow-x-auto rounded-lg shadow-lg">
                  <table className="min-w-full border-collapse">
                    <thead className='bg-[#2C2C2C] dark:bg-[#E7E7E7]'>
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider">Tanggal</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider">Waktu</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider">Aktivitas</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider">Alpha 1</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider">Alpha 2</th>
                        <th className="px-6 py-3 text-left text-sm font-medium uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#1A1A1A] dark:bg-[#F5F5F5] divide-y divide-[#2C2C2C] dark:divide-[#E7E7E7]">
                      {currentData.map((row, index) => (
                        <tr key={index} className="hover:bg-[#2C2C2C] dark:hover:bg-[#E7E7E7] transition duration-200">
                          <td className="px-6 py-4 text-sm">{row.date}</td>
                          <td className="px-6 py-4 text-sm">{row.start} - {row.end}</td>
                          <td className="px-6 py-4 text-sm capitalize">{row.activity}</td>
                          <td className="px-6 py-4 text-sm">
                            {row.alpha1 !== null ? row.alpha1.toFixed(2) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {row.alpha2 !== null ? row.alpha2.toFixed(2) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-white font-medium ${
                              row.status === "safe" ? "bg-green-500" :
                              row.status === "warning" ? "bg-orange-500" :
                              row.status === "danger" ? "bg-red-500" : "bg-gray-400"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-4">
                  <button
                    className="px-4 py-2 border rounded bg-[#2C2C2C] dark:bg-[#E7E7E7] hover:bg-[#3C3C3C] dark:hover:bg-[#D7D7D7] disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Sebelumnya
                  </button>
                  <span className="text-sm">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button
                    className="px-4 py-2 border rounded bg-[#2C2C2C] dark:bg-[#E7E7E7] hover:bg-[#3C3C3C] dark:hover:bg-[#D7D7D7] disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Berikutnya
                  </button>
                </div>

                {/* Toggle Grafik */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                  <button
                    onClick={() => toggleGraph('alpha1')}
                    className={`px-4 py-2 rounded transition ${activeGraphs.alpha1 ? 'bg-green-600 text-white' : 'bg-[#2C2C2C] dark:bg-[#E7E7E7]'}`}
                  >
                    {activeGraphs.alpha1 ? 'Hide' : 'Show'} Alpha 1
                  </button>
                  <button
                    onClick={() => toggleGraph('alpha2')}
                    className={`px-4 py-2 rounded transition ${activeGraphs.alpha2 ? 'bg-red-600 text-white' : 'bg-[#2C2C2C] dark:bg-[#E7E7E7]'}`}
                  >
                    {activeGraphs.alpha2 ? 'Hide' : 'Show'} Alpha 2
                  </button>
                  <button
                    onClick={() => toggleGraph('combined')}
                    className={`px-4 py-2 rounded transition ${activeGraphs.combined ? 'bg-blue-600 text-white' : 'bg-[#2C2C2C] dark:bg-[#E7E7E7]'}`}
                  >
                    {activeGraphs.combined ? 'Hide' : 'Show'} Combined
                  </button>
                  <button
                    onClick={() => toggleGraph('statusDistribution')}
                    className={`px-4 py-2 rounded transition ${activeGraphs.statusDistribution ? 'bg-purple-600 text-white' : 'bg-[#2C2C2C] dark:bg-[#E7E7E7]'}`}
                  >
                    {activeGraphs.statusDistribution ? 'Hide' : 'Show'} Status
                  </button>
                </div>

                {/* Grafik Alpha 1 */}
                {activeGraphs.alpha1 && (
                  <div className="mt-5 bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-2">Grafik Alpha 1 per Aktivitas</h3>
                    <div className="h-80">
                      <Line data={alpha1ChartData} options={chartOptions} />
                    </div>
                  </div>
                )}

                {/* Grafik Alpha 2 Harian */}
                {activeGraphs.alpha2 && (
                  <div className="mt-5 bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-2">Grafik Alpha 2 Harian</h3>
                    <div className="h-80">
                      <Line data={alpha2ChartData} options={chartOptions} />
                    </div>
                  </div>
                )}

                {/* Combined Graph */}
                {activeGraphs.combined && (
                  <div className="mt-5 bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-2">Grafik Combined Alpha 1 & Alpha 2</h3>
                    <div className="h-80">
                      <Line data={combinedChartData} options={chartOptions} />
                    </div>
                  </div>
                )}

                {/* Status Distribution Graph */}
                {activeGraphs.statusDistribution && (
                  <div className="mt-5 bg-[#2C2C2C] dark:bg-[#E7E7E7] p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-2">Distribusi Status</h3>
                    <div className="h-80">
                      <Bar data={statusDistributionData} options={statusDistributionOptions} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}