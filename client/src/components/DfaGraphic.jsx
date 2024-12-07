import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1,
    DFA: 1
};

function DfaGraphic({ data, label, keyValue, color }) {

    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef();
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);
    const XCount = 5;

    const formatedDate = (date) => {
        // console.log({ date })
        if (typeof date == 'string') {
            const [d, m, y] = date.split('-');
            console.log(`${y}-${m}-${d}`)
            return `${y}-${m}-${d}`;
        } else {
            return date;
        }
    }

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
            drawChart(data);
            // console.log('plus..')
            // simulateScroll(768 * (scroolState[label] - 1))
        } else if (opt == 'decrement' && scroolState[label] > 1) {
            setSlider(slider - 1);
            scroolState[label]--;
            drawChart(data)
            // console.log('decrement..')
            // simulateScroll((768 * (scroolState[label] - 1)));
        }
    }

    // useEffect(() => {
    //   // init for using label x date
    //   const parseDate = d3.timeParse('%d-%m-%Y %H:%M:%S'); // function untuk merubah string to date

    data.forEach(d => {
        // Format tanggal asli tanpa waktu
        // const dateStr = new Date(formatedDate(d.tanggal)).toISOString().split('T')[0]; // Ambil bagian tanggal saja (yyyy-mm-dd)
        const dateStr = new Date(d.timestamp_tanggal);
        // Gabungkan dengan waktu_awal
        const combinedDateTime = `${dateStr}T${d.waktu_awal}`; // Format ISO: yyyy-mm-ddTHH:MM:SS
        // console.log({ combinedDateTime, dateStr }, d);
        // console.log(typeof d.tanggal != 'object')
        // Buat objek Date baru berdasarkan gabungan
        if (typeof d.tanggal != 'object') {
            d.tanggal = dateStr // Update tanggal agar mengikuti waktu_awal
        }

        let statusA1 = 'Safe';
        let statusA2 = 'Safe';

        if (d.dfa.alpha1 > 1.2) statusA1 = 'Warning'
        if (d.dfa.alpha1 > 1.5) statusA1 = 'Danger'

        if (d.dfa.alpha2 > 1.2) statusA2 = 'Warning'
        if (d.dfa.alpha2 > 1.5) statusA2 = 'Danger'


        // Debugging, lihat hasilnya

        d.statusA1 = statusA1;
        d.statusA2 = statusA2;
        // console.log(d.tanggal);
    });

    // console.log({ data })

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    const drawChart = (rawData) => {
        // console.log({rawData})
        let processedData = rawData.filter(d => d.dfa !== null);
        processedData.sort((a, b) => a.tanggal - b.tanggal)
        console.log(processedData.length);
        // filtering warna circle

        let page = scroolState[label] - 1;
        let maxTitik = 20;

        // Fungsi untuk mendapatkan data sesuai dengan halaman
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }

        // Mendapatkan data yang diproses untuk halaman saat ini
        const paginatedData = getPaginatedData(processedData, page, maxTitik);
        processedData = paginatedData;

        console.log({ processedData, page, maxTitik })

        let colorA1 = processedData.map(item => {
            if (item.statusA1 === 'Safe') return 'rgba(69, 252, 124, 0.9)'; // Merah untuk berjalan 
            if (item.statusA1 === 'Warning') return 'rgba(246, 118, 37, 0.9)'; // Hijau untuk tidur
            if (item.statusA1 === 'Danger') return 'rgba(255, 0, 0, 0.9)'; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 'rgba(7, 172, 123, 1)'; // Warna default
        });

        let colorA2 = processedData.map(item => {
            if (item.statusA2 === 'Safe') return 'rgba(69, 252, 124, 0.9)'; // Merah untuk berjalan 
            if (item.statusA2 === 'Warning') return 'rgba(246, 118, 37, 0.9)'; // Hijau untuk tidur
            if (item.statusA2 === 'Danger') return 'rgba(255, 0, 0, 0.9)'; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 'rgba(7, 172, 123, 1)'; // Warna default
        });

        let sizeCircleA1 = processedData.map((item, i) => {
            if (item.statusA1 === 'Safe') return 4; // Merah untuk berjalan 
            if (item.statusA1 === 'Warning') return 6; // Hijau untuk tidur
            if (item.statusA1 === 'Danger') return 8; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 4; // Warna default
        })

        let sizeCircleA2 = processedData.map(item => {
            if (item.statusA2 === 'Safe') return 4; // Merah untuk berjalan 
            if (item.statusA2 === 'Warning') return 6; // Hijau untuk tidur
            if (item.statusA2 === 'Danger') return 8; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 4; // Warna default
        });


        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove()

        const height = 500;
        let width = 678;
        // let width = (34 * processedData.length) + 30;
        // let width = rawData.length * 70;
        // if (rawData.length > 10) {
        //     width = rawData.length * 50;
        // }
        const margin = { top: 20, right: 20, bottom: 90, left: 50 };
        let svgWidth;

        if (window.innerWidth > 980) {
            svgWidth = 768;
        } else if (window.innerWidth > 540) {
            svgWidth = window.innerWidth * 0.7;
        } else {

            console.log('hp')
            svgWidth = window.innerWidth * 0.8;
        }

        setSlice(Math.floor(rawData.length / maxTitik) + 1);

        let defaultColor = "rgba(7, 172, 123, 1)";

        const theme = localStorage.getItem('_isLightMode');
        if (theme == "true") { // is light state
            defaultColor = "rgba(33,113,122, 1)";
        }

        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bg-[#101010] dark:bg-[#FEFCF5] min-w-lg')

        // const x = d3.scaleBand()
        //     .domain(processedData.map(d => d.tanggal))
        //     .range([margin.left, width - margin.right]);

        const x = d3.scaleBand()
            .domain(processedData.map(d => d.tanggal))
            .range([margin.left, width - margin.right])
            .padding(0.05);  // Kurangi padding agar lebih banyak label ditampilkan

        const y = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => Math.max(d[keyValue].alpha1, d[keyValue].alpha2)) + 0.2])
            .range([height - margin.bottom, margin.top]);

        // const line = d3.line()
        //     .x(d => x(d.tanggal))
        //     .y(d => y(d[[keyValue]]));

        const lineA1 = d3.line()
            .x(d => x(d.tanggal))
            .y(d => y(d.dfa.alpha1));

        const lineA2 = d3.line()
            .x(d => x(d.tanggal))
            // .y(d => y(d[["dfa"]?.alpha2]));
            .y(d => y(d.dfa.alpha2));

        // svg.append('path')
        //     .datum(processedData)
        //     .attr('fill', 'none')
        //     .attr('stroke', color[0])
        //     .attr('stroke-width', 2)
        //     .attr('d', line);

        processedData.forEach(d => {
            if (!d.tanggal || isNaN(d[keyValue]?.alpha1) || isNaN(d[keyValue]?.alpha2)) {
                console.error('Invalid data:', d);
            }

            console.log(d[keyValue])
        });

        console.log({ defaultColor, lineA1, lineA2 }, paginatedData[0][keyValue].alpha1)
        let linePathA1 = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', colorA1[0])
            .attr('stroke-width', 2)
            .attr('d', lineA1);

        let linePathA2 = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', colorA2[0])
            .attr('stroke-width', 2)
            .attr('d', lineA2);

        // Deteksi perubahan tanggal
        let previousDate = null;

        processedData.forEach((d, i) => {
            // console.log({ d }, 'DfaGraphic');
            const currentDate = d.tanggal.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.tanggal)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.tanggal)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', theme == "true" ? "gray" : "white")
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.tanggal) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', theme == "true" ? "gray" : "white")
                    .attr('font-size', 10)
                    .text(currentDate);
            }
            previousDate = currentDate;
        });

        // Memberikan titik pada ujung sumbu y
        console.log({ colorA1, colorA2 })

        const circleAlpha1 =
            svg.selectAll('circle.alpha1')
                .data(processedData)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.tanggal))
                .attr('cy', d => y(d[keyValue].alpha1))
                .attr('r', (d, i) => sizeCircleA1[i])
                .attr('fill', (d, i) => colorA1[i % colorA1.length])
                .on('mouseover', (event, d) => {
                    const [xPos, yPos] = d3.pointer(event);
                    let x = xPos + 10;
                    if (scroolState[label] > 1) {
                        // x = xPos - (768 * (scroolState[label] - 1));
                    }
                    tooltip.style('left', `${x}px`)
                        .style('top', `${(yPos + 10)}px`)
                        .style('opacity', 1)
                        .html(`<p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
                            <p>Waktu awal : ${d.waktu_awal}</p>
                            <p>Waktu akhir : ${d.waktu_akhir}</p>
                            <p>${keyValue}: ${d[keyValue].alpha1}</p>
                            <p>Status Dfa: ${d["statusA1"]}</p>`);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });


        const circleAlpha2 =
            svg.selectAll('circle.alpha2')
                .data(processedData)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.tanggal))
                .attr('cy', d => y(d[keyValue].alpha2))
                .attr('r', (d, i) => sizeCircleA2[i])
                .attr('fill', (d, i) => colorA2[i % colorA2.length])
                .on('mouseover', (event, d) => {
                    const [xPos, yPos] = d3.pointer(event);
                    let x = xPos + 10;
                    if (scroolState[label] > 1) {
                        // x = xPos - (768 * (scroolState[label] - 1));
                    }
                    tooltip.style('left', `${x}px`)
                        .style('top', `${(yPos + 10)}px`)
                        .style('opacity', 1)
                        .html(`<p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
                            <p>Waktu awal : ${d.waktu_awal}</p>
                            <p>Waktu akhir : ${d.waktu_akhir}</p>
                            <p>${keyValue}: ${d[keyValue].alpha2}</p>
                            <p>Status Dfa: ${d["statusA2"]}</p>`);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });

        // Sumbu X dengan format jam menit detik saja
        const formatTime = d3.timeFormat("%H:%M:%S");
        svg.append('g')
            .attr('transform', `translate(${margin.left}, -5)`)
            .call(d3.axisLeft(y)
                .ticks(15));

        svg.append('g')
            .attr('transform', `translate(-15,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickFormat(formatTime)
                .ticks(XCount)
                .tickPadding(8))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', 8);


    }


    // Fungsi untuk memproses data dan menghilangkan duplikat
    // const processData = (rawData) => {
    //     // Urutkan data berdasarkan tanggal
    //     const sortedData = rawData.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    //     // Gunakan Set untuk menyimpan nilai unik
    //     const uniqueValues = new Set();

    //     // Filter data untuk menghilangkan duplikat
    //     return sortedData.filter(item => {
    //         const value = item[keyValue];
    //         if (!uniqueValues.has(value)) {
    //             uniqueValues.add(value);
    //             return true;
    //         }
    //         return false;
    //     });
    // }

    // const y = d3.scaleTime()
    // .domain()

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
            <div data-aos="fade-up" className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        {scroolState[label] > 1 ? (
                            <button type='button' className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                                <FaAngleLeft color='white' size={16} />

                            </button>
                        ) : null}
                        {scroolState[label] < slice ? (
                            <button type='button' className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('plus')}>
                                <FaAngleRight color='white' size={16} />
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Graphic {label}
                    </button>

                    {/* <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                       Safe
                        <span className='ms-2 w-4 h-4 bg-[#43ff64d9] rounded-full text-xs text-transparent'>wii</span>
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                      Warning
                        <span className='ms-2 w-4 h-4 bg-[#f67625e6] rounded-full text-xs text-transparent'>wii</span>
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                     Danger
                        <span className='ms-2 w-4 h-4 bg-[#ff0000e6] rounded-full text-xs text-transparent'>wii</span>
                    </button> */}
                </div>
            </div>
            <div className="relative overflow-x-auto" data-aos="fade-right">
                <div ref={chartRef} className='svg-container flex max-w-screen relative ' id={`svg-container-${label}`}>

                </div>
                {/* <div className="rectangle w-full h-full z-[2] absolute top-0 left-0"></div> */}
            </div>

        </div>
    )

}

export default DfaGraphic;