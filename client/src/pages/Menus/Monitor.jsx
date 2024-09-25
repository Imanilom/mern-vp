import React, { useEffect, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';
import { useRef } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";


import '../../loading.css';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import DailyMetric from '../../components/DailyMetric';
import GrafikMetric from '../../components/GrafikMetric';
// import '../../tableresponsive.css';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import LineGraph from '../../components/LineGraph';
import ScatterGraph from '../../components/ScatterGraph';

let results = []

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
  const [isPoincareVisible, setPoincareIsVisible] = useState(false); // Show Poincare chart by default
  const [device, setDevice] = useState("C0680226");
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
    fetchLogs(device);
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
      if (currentUser.role != 'user') {
        url = `/api/user/test/${device}`;
      }
      
      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }
      console.log({url}, currentUser.role != 'user' && device)
      const response = await fetch(url);
      const data = await response.json();
      console.log({ data })
      if (!response.ok) {
        setLogs([]);

        setMetrics([]);
        setDailyMetrics([]);

        dispatch(clearLogsWithDailytMetric());
        return
      }

      // let payloadRedux = {};
      const sortedLogs = data.logs.sort((a, b) => b.timestamp - a.timestamp); // Sort logs from newest to oldest
      setLogs(sortedLogs);

      // payloadRedux.logs = sortedLogs;

      // setBorderColor
      const borderColor = sortedLogs.map(item => {
        if (item.activity === 'Berjalan') return 'rgba(249, 39, 39, 0.8)'; // Merah untuk berjalan 
        if (item.activity === 'Tidur') return 'rgba(63, 234, 53, 0.8)'; // Hijau untuk tidur
        if (item.activity === 'Berolahraga') return 'rgba(116, 12, 224, 0.8)'; // Ungu untuk Berolahraga
        // return 'rgba(75, 192, 192, 1)'; // Warna default
        return 'rgba(75, 192, 192, 1)'; // Warna default
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
        console.log({ dailyMetrictResult });

        // payloadRedux.dailymetricR = dailyMetrictResult;

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
        // payloadRedux.medianPropertyR = median;
        // dispatch(setLogsWithDailyMetric(payloadRedux));
        // dispatch(setDefautlFetchTrue());
        // console.log(median)
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyMetrics = (logs, CollectionHR) => {
    // console.log('HR', logs)
    const groupedLogs = logs.reduce((acc, log) => {
      const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push({ ...log });
      return acc;
    }, {});

    // Add DFA value here..
    // console.log(groupedLogs)

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

  // const formatDate = (unixTimestamp) => {
  //   const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
  //   return date.toLocaleString(); // Adjust the format as needed
  // };


  const handleChangeDevice = (e) => {
    e.preventDefault();
    setDevice(e.target.value);
    fetchLogs(e.target.value);
  }

  return (
    <div>
      <main className=''>
        <section className="bg-white flex">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bg-white w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0">
                <div className="flex flex-wrap items-center">
                  <ButtonOffCanvas index={2} />
                  <div className="relative w-full sm:px-4 max-w-full flex-grow flex-1 flex justify-betwee">
                    {currentUser.role == 'user' ? (
                      <h3 className="font-semibold text-base text-blueGray-700">Monitoring || Device {currentUser.role == 'user' ? currentUser.current_device : DocterPatient.current_device} </h3>
                    ) : (
                      <div className="md:flex justify-between items-center w-full">

                        <h3 className="font-semibold text-base text-blueGray-700 mb-3">Monitoring || Device {device ?? 'nothing'} </h3>
                        <select name="" id="" className='max-w-[170px] border border-slate-200 rounded-md px-3 py-1' onChange={handleChangeDevice}>
                          <option value="" disabled>Select device Monitoring</option>
                          <option value="C0680226" selected>C0680226</option>
                          <option value="BA903328">BA903328</option>
                        </select>
                        {loading ? (
                          <span class="ms-4 loader "></span>
                        ) : null}

                      </div>
                    )}
                  </div>
                </div>

                <DailyMetric dailyMetrics={dailyMetrics} medianProperty={medianProperty} />

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
                    className="p-2 border border-gray-300 rounded text-sm md:text-[16px]"
                  />
                  {loading ? (
                    <span class="ms-4 loader "></span>
                  ) : null}

                </div>

              </div>
            </div>
            {logs ? (
              <div style={{ overflowX: 'auto' }}>

                <div className='flex flex-col gap-6'>
                  <LineGraph data={logs} label={`RR`} keyValue={`RR`} color={borderColor} />
                  <LineGraph data={logs} label={`HR`} keyValue={`HR`} color={borderColor} />
                  <ScatterGraph data={logs} label={`PointCare`} keyValue={`HR`} color={borderColor} />
                </div>
              </div>
            ) : null}
            {/* <div className="flex items-center rounded-md shadow-sm mt-4 mb-8 gap-1">
              <ToggleButton text="RR" isVisible={isRRVisible} onClick={toggleVisibilityRR} />
              <ToggleButton text="HR" isVisible={isHRVisible} onClick={toggleVisibilityHR} />
              <ToggleButton text="Poincare" isVisible={isPoincareVisible} onClick={toggleVisibilityPoincare} />
            </div>
            {logs ? (
              <GrafikMetric logs={logs} isHRVisible={isHRVisible} isRRVisible={isRRVisible} isPoincareVisible={isPoincareVisible} borderColor={borderColor} />
            ) : null} */}
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

// let scroolState = 1;
// function TestD3({ data, label, keyValue }) {
//   const [scroolLevel, setScroolLevel] = useState(1);
//   const chartRef = useRef();

//   // useEffect(() => {
//   //   const parseDate = d3.timeParse('%d-%m-%Y %H:%M:%S'); // function untuk merubah string to date
//   //   const theCurrentData = data;
//   //   theCurrentData.forEach(d => {
//   //     // const mergeDateTime = `${d.date} ${d.time}`;
//   //     d.datetime = parseDate(d.datetime); // merubah isi dari array
//   //   });

//   //   drawChart(theCurrentData);
//   // }, [data])

//   function simulateScroll(left) {
//     const container = document.getElementById('svg-container');
//     container.scrollLeft = left;
//   }

//   const triggerSimulate = (opt) => {
//     if (opt == 'plus' && scroolState < 3) {
//       scroolState++;
//       simulateScroll(768 * (scroolState - 1))
//     } else if (opt == 'decrement' && scroolState > 1) {
//       scroolState--;
//       simulateScroll((768 * (scroolState - 1)));
//     }
//   }

//   // useEffect(() => {
//   //   // init for using label x date
//   //   const parseDate = d3.timeParse('%d-%m-%Y %H:%M:%S'); // function untuk merubah string to date
//   //   data.forEach(d => {
//   //     // const mergeDateTime = `${d.date} ${d.time}`;
//   //     d.datetime = parseDate(d.datetime); // merubah isi dari array
//   //   });


//   //   drawChart(data);
//   // }, []);

//   const changeZoomText = (zoomV) => {
//     document.getElementById("zoom_panel").innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
//   }

//   const drawChart = (data) => {

//     // mengambil element tooltip
//     const tooltip = d3.select('#tooltip');
//     // reset gambar svg
//     const lastSvg = d3.select(chartRef.current);
//     lastSvg.selectAll('*').remove()

//     // Tentukan ukuran chart
//     const height = 500;
//     const width = 768 * 3;
//     const margin = { top: 20, right: 20, bottom: 80, left: 40 }

//     // Buat SVG di dalam div yang menggunakan useRef
//     const svg = d3.select(chartRef.current)
//       .append('svg')
//       // .attr('class', classTailwindCSS)
//       .attr('height', height)
//       .attr('width', width)
//       .style('background', '#FFFFFF')
//       .attr('class', 'svgOne')

//     const x = d3.scaleTime()
//       .domain(d3.extent(data, d => d.datetime)) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
//       .range([margin.left, width - margin.right]);
//     // const x = d3.scaleTime()
//     //   .domain(d3.extent(data, d => d.datetime)) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
//     //   .range([margin.left, width - margin.right]);


//     const y = d3.scaleLinear()
//       .domain([0, d3.max(data, d => d[keyValue])]) // membentuk garis dari 0 hingga data value paling tinggi (max)
//       .range([height - margin.bottom, margin.top]);
//     // Pada sumbu Y, kita biasanya ingin nilai 0 berada di bawah (koordinat terbesar),
//     // dan nilai terbesar berada di atas (koordinat terkecil). Oleh karena itu, range Y
//     // dibalik, dari [height, 0]. Jadi, 0 akan dipetakan ke bagian bawah grafik
//     // (misalnya height = 400), dan 90 akan dipetakan ke bagian atas (0).

//     const line = d3.line()
//       .x(d => x(d.datetime))
//       .y(d => y(d[[keyValue]]));

//       console.log({line})

//     // gambar line
//     const linepath = svg.append('path')
//       .datum(data)
//       .attr('fill', 'none')
//       .attr('stroke', 'rgba(75, 192, 192, 1)')
//       .attr('stroke-width', 2)
//       .attr('d', line);

//     // memberikan titik pada ujung sumbu y
//     const circles = svg.selectAll('circle')
//       .data(data)
//       .enter()
//       .append('circle')
//       .attr('cx', d => x(d.datetime))
//       .attr('cy', d => y(d[keyValue]))
//       .attr('r', 4)
//       .attr('fill', 'rgba(75, 192, 192, 1)')
//       .on('mouseover', (event, d) => {
//         const [xPos, yPos] = d3.pointer(event); // mouse x, y
//         // const scrollX = svg.node().parentElement.scrollLeft; // Ambil scroll horizontal dari container
//         // const scrollY = svg.node().parentElement.scrollTop; // Ambil scroll vertical dari container
//         // console.log({ xPos, yPos, scrollX })
//         let x = xPos + 10;
//         if (scroolState > 1) {
//           x = xPos - (768 * (scroolState - 1));
//           console.log(x, xPos, (768 * (scroolState - 1)))
//         }
//         console.log({ scroolLevel, scroolState }, (xPos - (scroolState * 768) + 10), xPos, { x });
//         tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
//           .style('top', `${(yPos + 10)}px`)
//           .style('opacity', 1)
//           .text(`Date: ${String(d.datetime).split('GMT')[0]}  ${keyValue}: ${d[keyValue]}`);
//       })
//       .on('mouseout', () => {
//         tooltip.style('opacity', 0);
//       });


//     // Buat format tanggal dan waktu dengan d3.timeFormat
//     const formatDateTime = d3.timeFormat("%d-%m-%Y %H:%M:%S");

//     svg.append('g') // g = group
//       .attr('transform', `translate(0,${height - margin.bottom})`) // translate x, y
//       .call(d3.axisBottom(x)
//         .tickFormat(formatDateTime)
//         .ticks(40) // memberikan jumlah titk yang dapat dicetak pada sumbu x
//         .tickPadding(8)) // jarak antar titik dengan label
//       // .tickFormat(d3.timeFormat("%H:%M:%S")) // Format lengkap dengan jam, menit, dan detik
//       // .ticks(5) // Tentukan jumlah ticks, bisa diubah sesuai kebutuhan // ?
//       .selectAll('text') // Memilih semua elemen teks (label) pada sumbu
//       .attr('transform', 'rotate(-35)') // Memutar label 45 derajat
//       .style('text-anchor', 'end') // Menyelaraskan teks ke ujung

//     svg.append('g')
//       .attr('transform', `translate(${margin.left}, 0)`)
//       .call(d3.axisLeft(y)
//         .ticks(15));

//     // fungsi untuk zoom in / zoom out
//     const chartGroup = svg.append('g');
//     const zoomed = (event) => {
//       const newX = event.transform.rescaleX(x);
//       const newY = event.transform.rescaleY(y);

//       console.log(newX, newY, event);
//       changeZoomText(event.transform.k);

//       x.call(d3.axisBottom(newX).ticks(39).tickPadding(8));
//       y.call(d3.axisLeft(newY).ticks(15));

//       linepath.attr('d', d3.line()
//         .x(d => newX(d.datetime))
//         .y(d => newY(d[[keyValue]]))
//       );

//       circles
//         .attr('cx', d => newX(d.datetime))
//         .attr('cy', d => newY(d[keyValue]));
//     };

//     // Tambahkan event zoom pada SVG
//     svg.call(d3.zoom()
//       .scaleExtent([1, 100])  // Atur batas zoom in dan zoom out
//       .translateExtent([[0, 0], [width, height]])  // Batas area yang bisa di-pan
//       .on('zoom', zoomed));  // Panggil fungsi zoomed saat zoom/pan terjadi

//   }


//   // const y = d3.scaleTime()
//   // .domain()

//   return (
//     <div className='relative p-4'>
//       <div id="tooltip"></div>
//       <div className="me-auto mb-3 flex items-center">
//         <button className='rounded-md bg-slate-800 px-3 py-1 border me-1' onClick={() => triggerSimulate('decrement')}>
//           <FaAngleLeft color='white' size={16} />

//         </button>
//         <button className='rounded-md bg-slate-800 px-3 py-1 border me-1' onClick={() => triggerSimulate('plus')}>
//           <FaAngleRight color='white' size={16} />
//         </button>
//         <button id='zoom_panel' className='rounded-md bg-slate-800 px-3 py-1 border me-1 text-white font-semibold text-sm' disabled>
//           Zoom level 1
//         </button>
//         <button id='zoom_panel' className='rounded-md bg-blue-500 px-3 py-1 border me-1 text-white font-semibold text-sm' disabled>
//           Graphic {label}
//         </button>
//       </div>
//       <div ref={chartRef} className='svg-container' id='svg-container'>

//       </div>

//     </div>
//   )
// }