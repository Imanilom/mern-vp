import React, { useState } from 'react'
import './chart.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/LandingPage/Home';
import About from './pages/LandingPage/About';
import Project from './pages/LandingPage/Project';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Side';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import Profile from './pages/Menus/Profile';
// Dashboard
import Summary from './pages/Menus/Summary';
import Monitor from './pages/Menus/Monitor';
import MedicalHistories from './pages/Menus/MedicalHistories';
import RiskFactor from './pages/Menus/RiskFactor';
import DetectionHistories from './pages/Menus/DetectionHistories';
import Treatment from './pages/Menus/Treatment';
import MyPatients from './pages/Menus/MyPatients';


import CreatePrediction from './pages/Menus/CreatePrediction';
import RiskPrediction from './pages/Menus/RiskPrediction';
// Crud

// Recomendation
import Recommendation from './pages/Menus/Recommendation';
import CreateRecomendation from './pages/Menus/CreateRecomendation';
import UpdateRecomendation from './pages/Menus/UpdateRecomendation';
import RecomendationDetail from './pages/Menus/RecomendationDetail';

//Activity >>
import Activity from './pages/Menus/Activity';
import CreateActivity from './pages/Menus/CreateActivity';
import UpdateActivity from './pages/Menus/UpdateActivity';
import SetActivity from './pages/Menus/SetActivity';
//Activity END >>

// Anamnesa
import Anamnesa from './pages/Menus/Anamnesa';
import InputMedicalHistory from './pages/Menus/InputMedicalHistory';
// Private Route

import PrivateRoute from './components/PrivateRoute';
import CreateAnamnesa from './pages/Menus/CreateAnamnesa';
import UpdateAnemnesa from './pages/Menus/UpdateAnemnesa';
import CreateTreatment from './pages/Menus/CreateTreatment';
import UpdateTreatment from './pages/Menus/UpdateTreatment';


//

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";


export default function App() {

  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path='/sign-in' element={<SignIn />} />
        <Route path='/sign-up' element={<SignUp />} />
        <Route path='/' element={<Home />} />
        <Route path='/about' element={<About />} />
        <Route path='/project' element={<Project />} />

        {/* PRIVATE ROUTE */}

        <Route element={<PrivateRoute />}>
          <Route path='/profile' element={<Profile />} />
          <Route path='/ringkasan-pasien' element={<Summary />} />
          <Route path='/monitor' element={<Monitor />} />
          <Route path='/activity' element={<Activity />} />
          <Route path='/set/activity/:encrypt' element={<SetActivity />} />
          <Route path='/my-patients' element={<MyPatients />} />
          <Route path='/input-medical' element={<InputMedicalHistory />} />
          <Route path='/createAnamnesa/:riwayatid' element={<CreateAnamnesa />} />
          <Route path='/create/prediksi_factor' element={<CreatePrediction />} />
          <Route path='/treatment/create' element={<CreateTreatment />} />

          <Route path='/rekomendasi/detail/:id' element={<RecomendationDetail />} />
          <Route path='/createRecomendation' element={<CreateRecomendation />} />
          <Route path='/updateAnemnesa/:id' element={<UpdateAnemnesa />} />
          <Route path='/updateRecomendation/:id' element={<UpdateRecomendation />} />
          <Route path='/createActivity' element={<CreateActivity />} />
          <Route path='/updateActivity/:id' element={<UpdateActivity />} />
          <Route path='/treatment/update/:id' element={<UpdateTreatment />} />
          <Route path='/riwayat-medis' element={<MedicalHistories />} />
          <Route path='/faktor-resiko' element={<RiskFactor />} />
          <Route path='/prediksi-faktor' element={<RiskPrediction />} />
          <Route path='/riwayat-deteksi' element={<DetectionHistories />} />
          <Route path='/treatment' element={<Treatment />} />
          <Route path='/rekomendasi' element={<Recommendation />} />
          <Route path='/anamnesa' element={<Anamnesa />} />
          <Route path='/d3' element={<TestD3 />} />
          <Route path='/d3scatter' element={<TestD3Scatter />} />
        </Route>
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}


let scroolState = 1;
const data = [ // data x (tanggal harus berurutan)
  { date: '2023-01-01', time: '11:10:00', value: 30 },
  { date: '2023-01-01', time: '11:10:05', value: 80 },
  { date: '2023-01-01', time: '11:11:30', value: 45 },
  { date: '2023-01-01', time: '11:11:45', value: 60 },
  { date: '2023-01-01', time: '11:15:15', value: 40 },
  { date: '2023-01-01', time: '11:16:00', value: 90 },
  { date: '2023-01-01', time: '11:16:17', value: 120 },
  { "date": "2023-01-01", "time": "11:20:05", "value": 35 },
  { "date": "2023-01-01", "time": "11:21:00", "value": 70 },
  { "date": "2023-01-01", "time": "11:21:45", "value": 50 },
  { "date": "2023-01-01", "time": "11:22:15", "value": 85 },
  { "date": "2023-01-01", "time": "11:25:10", "value": 65 },
  { "date": "2023-01-01", "time": "11:26:00", "value": 110 },
  { "date": "2023-01-01", "time": "11:26:20", "value": 95 },
  { "date": "2023-01-01", "time": "11:30:05", "value": 55 },
  { "date": "2023-01-01", "time": "11:30:50", "value": 75 },
  { "date": "2023-01-01", "time": "11:31:35", "value": 40 },
  { "date": "2023-01-01", "time": "11:32:00", "value": 85 },
  { "date": "2023-01-01", "time": "11:35:25", "value": 90 },
  { "date": "2023-01-01", "time": "11:36:10", "value": 80 },
  { "date": "2023-01-01", "time": "11:36:45", "value": 95 },
  { "date": "2023-01-01", "time": "11:40:00", "value": 70 },
  { "date": "2023-01-01", "time": "11:41:20", "value": 60 },
  { "date": "2023-01-01", "time": "11:42:05", "value": 120 },
  { "date": "2023-01-01", "time": "11:45:15", "value": 85 },
  { "date": "2023-01-01", "time": "11:46:30", "value": 95 },
  { "date": "2023-01-01", "time": "11:47:00", "value": 60 },
  { "date": "2023-01-01", "time": "11:50:10", "value": 75 },
  { "date": "2023-01-01", "time": "11:51:05", "value": 90 },
  { "date": "2023-01-01", "time": "11:51:50", "value": 65 },
  { "date": "2023-01-01", "time": "11:55:00", "value": 80 },
  { "date": "2023-01-01", "time": "11:55:45", "value": 50 },
  { "date": "2023-01-01", "time": "11:56:30", "value": 110 },
  { "date": "2023-01-01", "time": "12:00:00", "value": 65 },
  { "date": "2023-01-01", "time": "12:01:15", "value": 95 },
  { "date": "2023-01-01", "time": "12:02:30", "value": 75 },
  { "date": "2023-01-01", "time": "12:05:00", "value": 85 },
  { "date": "2023-01-01", "time": "12:06:10", "value": 60 },
  { "date": "2023-01-01", "time": "12:06:55", "value": 90 },
  { "date": "2023-01-01", "time": "12:10:05", "value": 70 },
  { "date": "2023-01-01", "time": "12:11:00", "value": 65 },
  { "date": "2023-01-01", "time": "12:12:15", "value": 80 },
  { "date": "2023-01-01", "time": "12:15:00", "value": 95 },
  { "date": "2023-01-01", "time": "12:16:10", "value": 85 },
  { "date": "2023-01-01", "time": "12:17:00", "value": 75 },
  { "date": "2023-01-01", "time": "12:20:10", "value": 55 },
  { "date": "2023-01-01", "time": "12:21:20", "value": 90 },
  { "date": "2023-01-01", "time": "12:22:05", "value": 110 },
  { "date": "2023-01-01", "time": "12:25:00", "value": 85 },
  { "date": "2023-01-01", "time": "12:26:10", "value": 70 },
  { "date": "2023-01-01", "time": "12:27:05", "value": 60 },
  { "date": "2023-01-01", "time": "12:30:15", "value": 100 },
  { "date": "2023-01-01", "time": "12:31:20", "value": 80 },
  { "date": "2023-01-01", "time": "12:32:10", "value": 90 },
  { "date": "2023-01-01", "time": "12:35:00", "value": 70 },
  { "date": "2023-01-01", "time": "12:36:15", "value": 75 },
  { "date": "2023-01-01", "time": "12:37:05", "value": 85 }
];

const data2 = [
  { date: '2024-11-23', time: '20:28:00', value: [190, 121] },
  { date: '2024-11-23', time: '20:30:15', value: [250, 167] },
  { date: '2024-11-23', time: '20:32:30', value: [340, 221] },
  { date: '2024-11-23', time: '20:35:00', value: [415, 311] },
  { date: '2024-11-23', time: '20:38:45', value: [570, 432] },
  { date: '2024-11-23', time: '20:42:15', value: [605, 487] },
  { date: '2024-11-23', time: '20:45:30', value: [740, 590] },
  { date: '2024-11-23', time: '20:48:20', value: [325, 198] },
  { date: '2024-11-23', time: '20:50:00', value: [450, 323] },
  { date: '2024-11-23', time: '20:55:12', value: [512, 365] },
  { date: '2024-11-23', time: '21:00:00', value: [780, 620] },
  { date: '2024-11-23', time: '21:03:45', value: [650, 543] },
  { date: '2024-11-23', time: '21:07:10', value: [330, 200] },
  { date: '2024-11-23', time: '21:12:35', value: [500, 385] },
  { date: '2024-11-23', time: '21:18:25', value: [680, 552] },
  { date: '2024-11-23', time: '21:22:50', value: [715, 599] },
  { date: '2024-11-23', time: '21:25:40', value: [790, 630] },
  { date: '2024-11-23', time: '21:28:15', value: [290, 150] },
  { date: '2024-11-23', time: '21:30:50', value: [640, 522] },
  { date: '2024-11-23', time: '21:32:40', value: [680, 560] },
  { date: '2024-11-23', time: '21:36:00', value: [330, 250] },
  { date: '2024-11-23', time: '21:40:15', value: [490, 390] },
  { date: '2024-11-23', time: '21:43:30', value: [770, 610] },
  { date: '2024-11-23', time: '21:45:10', value: [510, 340] },
  { date: '2024-11-23', time: '21:48:25', value: [390, 278] },
  { date: '2024-11-23', time: '21:50:00', value: [570, 420] },
  { date: '2024-11-23', time: '21:52:45', value: [290, 180] },
  { date: '2024-11-23', time: '21:55:30', value: [620, 495] },
  { date: '2024-11-23', time: '21:58:20', value: [400, 275] },
  { date: '2024-11-23', time: '22:00:15', value: [530, 410] },
  { date: '2024-11-23', time: '22:03:50', value: [320, 190] },
  { date: '2024-11-23', time: '22:08:25', value: [780, 665] },
  { date: '2024-11-23', time: '22:10:00', value: [440, 305] },
  { date: '2024-11-23', time: '22:12:35', value: [510, 355] },
  { date: '2024-11-23', time: '22:15:00', value: [700, 580] },
  { date: '2024-11-23', time: '22:18:45', value: [540, 415] },
  { date: '2024-11-23', time: '22:20:30', value: [610, 470] },
  { date: '2024-11-23', time: '22:25:00', value: [330, 210] },
  { date: '2024-11-23', time: '22:28:15', value: [440, 320] },
  { date: '2024-11-23', time: '22:30:30', value: [710, 585] },
  { date: '2024-11-23', time: '22:33:50', value: [650, 530] },
  { date: '2024-11-23', time: '22:35:40', value: [620, 475] },
  { date: '2024-11-23', time: '22:40:00', value: [360, 250] },
  { date: '2024-11-23', time: '22:42:50', value: [590, 455] },
  { date: '2024-11-23', time: '22:45:30', value: [540, 410] },
  { date: '2024-11-23', time: '22:48:45', value: [700, 565] },
  { date: '2024-11-23', time: '22:50:15', value: [480, 340] },
  { date: '2024-11-23', time: '22:53:10', value: [750, 610] },
  { date: '2024-11-23', time: '22:58:00', value: [540, 420] }
]

function TestD3() {
  const [scroolLevel, setScroolLevel] = useState(1);
  const chartRef = useRef();

  // const data = [];
  function simulateScroll(left) {
    const container = document.getElementById('svg-container');
    container.scrollLeft = left;
  }

  const triggerSimulate = (opt) => {
    if (opt == 'plus' && scroolState < 3) {
      scroolState++;
      simulateScroll(768 * (scroolState - 1))
    } else if (opt == 'decrement' && scroolState > 1) {
      scroolState--;
      simulateScroll((768 * (scroolState - 1)));
    }
  }

  useEffect(() => {
    console.log({ data });
    const parseDate = d3.timeParse('%Y-%m-%d %H:%M:%S'); // function untuk merubah string to date
    data.forEach(d => {
      const mergeDateTime = `${d.date} ${d.time}`;
      d.date = parseDate(mergeDateTime); // merubah isi dari array
    });
    console.log({ data })

    drawChart(data);
  }, []);

  const changeZoomText = (zoomV) => {
    document.getElementById("zoom_panel").innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
  }

  const drawChart = (data) => {

    // mengambil element tooltip
    const tooltip = d3.select('#tooltip');
    // reset gambar svg 
    const lastSvg = d3.select(chartRef.current);
    lastSvg.selectAll('*').remove()

    // Tentukan ukuran chart
    const height = 500;
    const width = 768 * 3;
    const margin = { top: 20, right: 20, bottom: 80, left: 40 }


    // Buat SVG di dalam div yang menggunakan useRef
    const svg = d3.select(chartRef.current)
      .append('svg')
      // .attr('class', classTailwindCSS)
      .attr('height', height)
      .attr('width', width)
      .style('background', '#FFFFFF')
      .attr('class', 'svgOne')

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date)) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value)]) // membentuk garis dari 0 hingga data value paling tinggi (max)
      .range([height - margin.bottom, margin.top]);
    // Pada sumbu Y, kita biasanya ingin nilai 0 berada di bawah (koordinat terbesar), 
    // dan nilai terbesar berada di atas (koordinat terkecil). Oleh karena itu, range Y 
    // dibalik, dari [height, 0]. Jadi, 0 akan dipetakan ke bagian bawah grafik 
    // (misalnya height = 400), dan 90 akan dipetakan ke bagian atas (0).

    const line = d3.line()
      .x(d => x(d.date))
      .y(d => y(d.value));

    // gambar line
    const linepath = svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(75, 192, 192, 1)')
      .attr('stroke-width', 2)
      .attr('d', line);


    // memberikan titik pada ujung sumbu y
    const circles = svg.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', 'rgba(75, 192, 192, 1)')
      .on('mouseover', (event, d) => {
        const [xPos, yPos] = d3.pointer(event); // mouse x, y
        // const scrollX = svg.node().parentElement.scrollLeft; // Ambil scroll horizontal dari container
        // const scrollY = svg.node().parentElement.scrollTop; // Ambil scroll vertical dari container
        // console.log({ xPos, yPos, scrollX })
        let x = xPos + 10;
        if (scroolState > 1) {
          x = xPos - (768 * (scroolState - 1));
          console.log(x, xPos, (768 * (scroolState - 1)))
        }
        console.log({ scroolLevel, scroolState }, (xPos - (scroolState * 768) + 10), xPos, { x });
        tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
          .style('top', `${(yPos + 10)}px`)
          .style('opacity', 1)
          .text(`Date: ${String(d.date).split('GMT')[0]}  RR: ${d.value}`);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });


    // Buat format tanggal dan waktu dengan d3.timeFormat
    const formatDateTime = d3.timeFormat("%d-%m-%Y %H:%M:%S");

    svg.append('g') // g = group
      .attr('transform', `translate(0,${height - margin.bottom})`) // translate x, y
      .call(d3.axisBottom(x)
        .tickFormat(formatDateTime)
        .ticks(39) // memberikan jumlah titk yang dapat dicetak pada sumbu x
        .tickPadding(8)) // jarak antar titik dengan label
      // .tickFormat(d3.timeFormat("%H:%M:%S")) // Format lengkap dengan jam, menit, dan detik
      // .ticks(5) // Tentukan jumlah ticks, bisa diubah sesuai kebutuhan // ?
      .selectAll('text') // Memilih semua elemen teks (label) pada sumbu
      .attr('transform', 'rotate(-35)') // Memutar label 45 derajat
      .style('text-anchor', 'end') // Menyelaraskan teks ke ujung

    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y)
        .ticks(15));

    // fungsi untuk zoom in / zoom out
    const chartGroup = svg.append('g');
    const zoomed = (event) => {
      const newX = event.transform.rescaleX(x);
      const newY = event.transform.rescaleY(y);

      console.log(newX, newY, event);
      changeZoomText(event.transform.k);

      x.call(d3.axisBottom(newX).ticks(39).tickPadding(8));
      y.call(d3.axisLeft(newY).ticks(15));

      linepath.attr('d', d3.line()
        .x(d => newX(d.date))
        .y(d => newY(d.value))
      );

      circles
        .attr('cx', d => newX(d.date))
        .attr('cy', d => newY(d.value));
    };

    // Tambahkan event zoom pada SVG
    svg.call(d3.zoom()
      .scaleExtent([1, 5])  // Atur batas zoom in dan zoom out
      .translateExtent([[0, 0], [width, height]])  // Batas area yang bisa di-pan
      .on('zoom', zoomed));  // Panggil fungsi zoomed saat zoom/pan terjadi

  }


  // const y = d3.scaleTime()
  // .domain()

  return (
    <div className='relative p-4'>
      <div id="tooltip"></div>
      <div className="me-auto mb-3 flex items-center">
        <button className='rounded-md bg-slate-800 px-3 py-1 border me-1' onClick={() => triggerSimulate('decrement')}>
          <FaAngleLeft color='white' size={16} />

        </button>
        <button className='rounded-md bg-slate-800 px-3 py-1 border me-1' onClick={() => triggerSimulate('plus')}>
          <FaAngleRight color='white' size={16} />
        </button>
        <button id='zoom_panel' className='rounded-md bg-slate-800 px-3 py-1 border me-1 text-white font-semibold text-sm' disabled>
          Zoom level 1
        </button>
      </div>
      <div ref={chartRef} className='svg-container' id='svg-container'>

      </div>

    </div>
  )
}


function TestD3Scatter() {
  const chartRef = useRef();

  useEffect(() => {
    const parseDate = d3.timeParse('%Y-%m-%d %H:%M:%S');
    data2.forEach(d => {
      const mergeDateTime = `${d.date} ${d.time}`;
      d.date = parseDate(mergeDateTime);
    })

    drawChart(data2)
  }, [])

  const changeZoomText = (zoomV) => {
    document.getElementById("zoom_panel").innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
  }

  const drawChart = (data) => {
    // mengambil element tooltip
    const tooltip = d3.select('#tooltip');
    // reset gambar svg 
    const lastSvg = d3.select(chartRef.current);
    lastSvg.selectAll('*').remove();

    // porperty canvas chart
    const height = 500;
    const width = 768;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 }

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'white')
      .attr('class', 'svgTwo')

    const x = d3.scaleLinear()
      .domain([d3.min(data, d => d.value[0]) - 50, d3.max(data, d => d.value[0])])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value[1])])
      .range([height - margin.top, margin.bottom])

    const line = d3.line()
      .x(d => x(d.value[0]))
      .y(d => y(d.value[1]))

    const linepath = svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 2)
      .attr('d', line);

    const circles = svg.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.value[0]))
      .attr("cy", d => y(d.value[1]))
      .attr("r", 5)
      .attr("fill", "steelblue").on('mouseover', (event, d) => {
        const [xPos, yPos] = d3.pointer(event); // mouse x, y
        let x = xPos + 10;
        if (scroolState > 1) {
          x = xPos - (768 * (scroolState - 1));
          console.log(x, xPos, (768 * (scroolState - 1)))
        }
        console.log({ scroolState }, (xPos - (scroolState * 768) + 10), xPos, { x });

        tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
          .style('top', `${(yPos + 10)}px`)
          .style('opacity', 1)
          .text(`Date: ${String(d.date).split('GMT')[0]}  Point Care: [${d.value[0]}, ${d.value[1]}]`);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });

    //membuat label x
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom - 10})`)
      .call(d3.axisBottom(x)
        .ticks(20)
        .tickPadding(10)
      )
      .selectAll("line") // Memilih elemen line pada ticks
      .attr("stroke", "rgba(170, 39, 245, 0.9)") // Mengubah warna tick menjadi ungu
      .selectAll('text')
      .attr('transform', 'rotate(-35)') // Memutar label 45 derajat
      .style('text-anchor', 'end') // Menyelaraskan teks ke ujung


    // membuat label y
    svg.append('g')
      .attr('transform', `translate(${margin.left},${-margin.top})`)
      .call(d3.axisLeft(y)
        .ticks(20)
      )

    //zoom event
    const chartGroup = svg.append('g');
    const zoomed = (e) => {
      const newX = e.transform.rescaleX(x);
      const newY = e.transform.rescaleY(y);

      console.log('oke zoom')

      changeZoomText(e.transform.k);

      x.call(d3.axisBottom(newX)
        .ticks(20)
        .tickPadding(10))

      y.call(d3.axisLeft(newY)
        .ticks(20))

      linepath.attr('d', d3.line()
          .x(d => newX(d.value[0]))
          .y(d => newY(d.value[1]))
        );

      // const linepath = svg.append('path')
      // .datum(data)
      // .attr('fill', 'none')
      // .attr('stroke', 'transparent')
      // .attr('stroke-width', 2)
      // .attr('d', line);

      circles
        .attr('cx', d => newX(d.value[0]))
        .attr('cy', d => newY(d.value[1]))
    }

    // zoom trigger event
    svg.call(d3.zoom()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', zoomed));
  }

  return (
    <div className='relative p-4'>
      <div id="tooltip"></div>
      <div className="me-auto mb-3 flex items-center">
        <button id='zoom_panel' className='rounded-md bg-slate-800 px-3 py-1 border me-1 text-white font-semibold text-sm' disabled>
          Zoom level 1
        </button>
      </div>
      <div className="svg-container" id='svg-container' ref={chartRef}></div>
    </div>
  )
}
