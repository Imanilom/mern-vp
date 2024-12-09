import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1,
    iHR: 0,
    iRR: 0
};

function LineGraph({ data, label, keyValue, color }) {

    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef(); // buat canvas
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);

    useEffect(() => {
        AOS.init({
            duration: 700
        })
    }, [])

    let styleTooltype = {
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        padding: 5 + 'px',
        borderRadius: 3 + 'px',
        opacity: 0,
        transition: 'opacity 0.2s',
        fontSize: 12 + 'px',
        maxWidth: 300 + 'px',
        minWidth: 200 + 'px',
        zIndex: 99
    }

    let styleCircleInfo = {
        width: 20 + "px",
        height: 20 + "px",
        borderRadius: 50 + "%"
    }

    useEffect(() => {
        drawChart(data);
    }, [data])

    function simulateScroll(left) {
        const container = document.getElementById(`svg-container-${label}`);
        container.scrollLeft = left;
    }

    const triggerSimulate = (opt) => {
        if (opt == 'plus' && scroolState[label] < slice) {
            scroolState[label]++;
            setSlider(slider + 1);
            drawChart(data)
            // simulateScroll(768 * (scroolState[label] - 1))
        } else if (opt == 'decrement' && scroolState[label] > 1) {
            setSlider(slider - 1);
            scroolState[label]--;
            drawChart(data)
            // simulateScroll((768 * (scroolState[label] - 1)));
        }
    }

    // useEffect(() => {
    //   // init for using label x date
    //   const parseDate = d3.timeParse('%d-%m-%Y %H:%M:%S'); // function untuk merubah string to date
    data.forEach((d, i) => {
        // const mergeDateTime = `${d.date} ${d.time}`;

        d.create_at = new Date(d.timestamp * 1000); // merubah isi dari array
    });

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }


    // Fungsi untuk memproses data dan menghilangkan duplikat
    const processData = (rawData) => {
        // Urutkan data berdasarkan create_at
        const sortedData = rawData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        // Gunakan Set untuk menyimpan nilai unik
        const uniqueValues = new Set();

        // Filter data untuk menghilangkan duplikat
        return sortedData.filter(item => {
            const value = item[keyValue];
            if (!uniqueValues.has(value)) {
                uniqueValues.add(value);
                return true;
            }
            return false;
        });
    }

    const drawChart = (rawData) => {
        let sizeCircle = [];
        let processedData2 = processData(rawData);

        // Membuat array waktu dengan interval 10 menit
        processedData2 = processedData2.filter(d => d.RR !== null && d.HR !== null);

        // console.log(processedData2.map(d => d.create_at instanceof Date));

        // lakukan pengelompokan data sesuai hari
        const logsGroupDate = {};
        let date = "";
        let result = [];
        
        // Mengelompokkan data berdasarkan tanggal
        processedData2.forEach((val) => {
            date = val.datetime.split("T")[0];
            // const [y,m,d] = date.split("") 
            if (!logsGroupDate[date]) logsGroupDate[date] = [];
            logsGroupDate[date].push(val);
        });
        
        console.log({ logsGroupDate });
        
        // Proses data per tanggal
        Object.entries(logsGroupDate).forEach(([date, logs]) => {
            let labelingMinute = ["00", "15", "30", "45"];
            let labelingHour = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
        
            let startDataTimeHour = logs[0].create_at.getHours();
            let endDataTimeHour = logs[logs.length - 1].create_at.getHours();
        
            console.log({ logs, startDataTimeHour, endDataTimeHour });
        
            // Menambahkan waktu awal
            for (let hour = 0; hour < startDataTimeHour; hour++) {
                labelingMinute.forEach((minute) => {
                    let datetime = new Date(`${date}T${labelingHour[hour]}:${minute}:00`);
                    result.push({
                        HR: 0,
                        RR: 0,
                        create_at: datetime,
                        label: "safe",
                        timestamp: datetime.getTime(),
                    });
                });
            }
        
            // Menambahkan data asli
            logs.forEach((log) => result.push(log));
            console.log({date, logs})
        
            // Menambahkan waktu akhir
            for (let hour = endDataTimeHour ; hour < labelingHour.length; hour++) {
                labelingMinute.forEach((minute) => {
                    let datetime = new Date(`${date}T${labelingHour[hour]}:${minute}:00`);
                    console.log("DATA WAKTU AKHIR", datetime)
                    result.push({
                        HR: 0,
                        RR: 0,
                        create_at: datetime,
                        label: "safe",
                        timestamp: datetime.getTime(),
                    });
                });
            }


        });
        
        // Mengurutkan data berdasarkan waktu
        result.sort((a, b) => new Date(a.create_at) - new Date(b.create_at));
        console.log({ result });
        
        // Menambahkan indeks ke data
        result.forEach((d, i) => (d.index = i));
        
        // Paginasi
        let page = scroolState[keyValue] - 1;
        let maxTitik = 40;
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }
        
        const paginatedData = getPaginatedData(result, page, maxTitik);
        console.log({ paginatedData }, "INI PAGINATE");
        let processedData = paginatedData;        
        // console.log({ paginatedData, page }, paginatedData[0]);


        // console.log({processedData, startDataTimeHour, EndDataTimeHour})

        // filtering warna circle
        // color = processedData.map(item => {
        //     if (item.activity === 'Berjalan') return 'rgba(249, 39, 39, 0.8)'; // Merah untuk berjalan 
        //     if (item.activity === 'Tidur') return 'rgba(63, 234, 53, 0.8)'; // Hijau untuk tidur
        //     if (item.activity === 'Berolahraga') return 'rgba(116, 12, 224, 0.8)'; // Ungu untuk Berolahraga
        //     // return 'rgba(75, 192, 192, 1)'; // Warna default
        //     return 'rgba(7, 172, 123, 1)'; // Warna default
        // });

        let defaultColor = "rgba(7, 172, 123, 1)";

        const theme = localStorage.getItem('_isLightMode');
        if (theme == "true") { // is light state
            defaultColor = "rgba(33,113,122, 1)";
        }

        color = processedData.map((item, i) => {
            if (i > 0) {

                if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 10) {

                    return 'rgba(249, 39, 39, 0.8)';
                } else if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 5) {

                    return 'rgba(255, 161, 0, 1)';
                } else {
                    return defaultColor; // Warna default
                }
            } else {
                return defaultColor; // Warna default
            }
        });

        sizeCircle = processedData.map((item, i) => {
            if (i > 0) {

                if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 10) {

                    processedData[i]['label'] = "Danger";
                    return 8; // ukuran 6 untuk damger

                }
                else if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 5) {
                    processedData[i]['label'] = "Warning";
                    return 6;
                } else {
                    processedData[i]['label'] = "Safe";
                    return 4;
                }
            } else {
                processedData[i]['label'] = "Safe";
                return 4;
            }
        })

        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        const lastSvg = d3.select(chartRef.current); // variabel yang menampung element canvas

        lastSvg.selectAll('*').remove(); // 

        console.log(processedData.length);

        const height = 500;
        // let width = 50 * processedData.length;
        let width = 648;
        // if (processedData.length > 30) {
        //     width = 25 * processedData.length / 2;
        // }
        const margin = { top: 20, right: 20, bottom: 90, left: 50 };
        let svgWidth;

        if (window.innerWidth > 980) {
            svgWidth = 648;
        } else if (window.innerWidth > 540) {
            svgWidth = window.innerWidth * 0.7;
        } else {
            svgWidth = window.innerWidth * 0.8;
        }

        // setSlice(Math.floor(width / svgWidth) + 1);
        setSlice(Math.floor(result.length / maxTitik) + 1);

        const svg = d3.select(chartRef.current) // gambar canvas 
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bg-[#101010] dark:bg-[#FEFCF5] min-w-lg')

        // Atur skala waktu X
        const x = d3.scaleBand()
            .domain(processedData.map(d => d.create_at))
            // .range([margin.left, width - margin.right]);
            .range([margin.left, width - margin.right]);

        console.log({ x, keyValue })

        const y = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => d[keyValue] + 50)]) // Default maksimum 100 jika data kosong
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.create_at))
            .y(d => d[keyValue] !== null ? y(d[keyValue]) : y(0)); // Titik kosong ke nol

        // console.log({dataWithIntervals, processedData})
        svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', defaultColor)
            .attr('stroke-width', 2)
            .attr('d', line);

        // const xAxis = d3.axisBottom(x)
        // .ticks(d3.timeMinute.every(10)) // Interval 10 menit
        // .tickFormat(d3.timeFormat('%H:%M')) // Format HH:MM
        // .tickPadding(5)
        // Deteksi perubahan tanggal
        let previousDate = null;

        processedData.forEach((d, i) => {
            // console.log({ d }, 'Linegraph');
            const currentDate = d.create_at.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.create_at)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.create_at)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', theme == "true" ? "gray" : "white")
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.create_at) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', theme == "true" ? "gray" : "white")
                    .attr('font-size', 10)
                    .text(currentDate);
            }
            previousDate = currentDate;
        });

        // Memberikan titik pada ujung sumbu y
        svg.selectAll('circle')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.create_at))
            .attr('cy', d => y(d[keyValue]))
            .attr('r', (d, i) => sizeCircle[i])
            .attr('fill', (d, i) => color[i % color.length])
            .on('mouseover', function (event, d, i) { // Menggunakan function untuk akses parameter dengan benar
                // console.log({ d });
                let labelsPurposion;

                if (d.label == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                if (d.label == "Warning") labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                if (d.label == "Danger") labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;
                const [xPos, yPos] = d3.pointer(event);
                let x = xPos + 10;
                x = xPos;
                console.log({ x })
                if (scroolState[label] > 1) {
                    // x = xPos - (768 * (scroolState[label] - 1));
                }
                tooltip.style('left', `${x}px`)
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(` 
                                ${labelsPurposion}
                                
                                <p>Date: ${String(d.create_at).split('GMT')[0]}</p> 
                                <p>Aktivitas Pasien: ${d.activity === undefined ? 'Tidak ada riwayat' : d.activity}</p>
                                <p>${keyValue}: ${d[keyValue]}</p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });

        // Sumbu X dengan format jam menit detik saja
        const formatTime = d3.timeFormat("%H:%M:%S");
        svg.append('g')
            .attr('transform', `translate(0, ${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickFormat(formatTime)
                .ticks(20)
                .tickPadding(8))
            .selectAll('text') // Memilih semua teks label pada sumbu X
            .style('text-anchor', 'end') // Menyetel posisi anchor teks ke ujung
            .attr('dx', '-0.8em') // Mengatur jarak horizontal
            .attr('dy', '0.15em') // Mengatur jarak vertikal
            .attr('transform', 'rotate(-45)'); // Memutar teks label sebesar -45 derajat

        const yAxis = d3.axisLeft(y);
        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(yAxis);
    }

    // const y = d3.scaleTime()
    // .domain()

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
            <div data-aos="fade-up" className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        {scroolState[keyValue] > 1 ? (
                            <button className='rounded-md bg-slate-800 dark:bg-[#FFD166] px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                                <FaAngleLeft color='white' size={16} />
                            </button>
                        ) : null}
                        {scroolState[keyValue] < slice ? (
                            <button className='rounded-md bg-slate-800 dark:bg-[#FFD166] px-3 py-1 me-1' onClick={() => triggerSimulate('plus')}>
                                <FaAngleRight color='white' size={16} />
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    <button id={`zoom_panel_${label}`} className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Graphic {label}
                        <span className='ms-2 w-4 h-4 bg-[#07AC7B] dark:bg-[#217170] rounded-full text-xs text-transparent'>lLL</span>
                    </button>
                </div>
            </div>
            <div className="relative" data-aos="fade-right">
                <div ref={chartRef} className='svg-container relative ' id={`svg-container-${label}`}>

                </div>
                {/* <div className="rectangle w-full h-full z-[2] absolute top-0 left-0"></div> */}
            </div>

        </div>
    )
}

export default LineGraph;