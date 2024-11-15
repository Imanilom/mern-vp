import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1,
    InterQuartile: 1
};


function InterquartileGraph({ data, label, color }) {
    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef();
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);
    let XCount = 10;

    useEffect(() => {
        AOS.init({
            duration: 700
        })

        console.log('Interquartile log ', { data })
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

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    const drawChart = (rawData) => {
        // Proses data untuk menghilangkan duplikat
        // console.log({ rawData })

        let processedData2 = processData(rawData);
        // if (rawData.length <= 30) {
        //     // klo rawdata krang dari 30, gausa ada filter biar graphic nya bagus dikit :) 
        //     processedData2 = rawData;
        // } else {
        //     // klo lebih maka di filter biar ga terlalu banyak slide
        //     processedData2 = processData(rawData);
        // }

        processedData2.forEach(d => {
            d.date = new Date(d.timestamp * 1000);
        });

        let processedData = processedData2.filter(d => d.RR !== null && d.HR !== null);

        XCount = processedData.length;
        // console.log({ processedData, XCount })

        let page = scroolState[label] - 1;
        let maxTitik = 40;

        // Fungsi untuk mendapatkan data sesuai dengan halaman
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }

        // Mendapatkan data yang diproses untuk halaman saat ini
        const paginatedData = getPaginatedData(processedData, page, maxTitik);
        processedData = paginatedData;

        console.log({ paginatedData })
        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        // console.log({ label, data, tooltip })

        // reset gambar svg 
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove()

        // Tentukan ukuran chart
        const height = 500;
        // const width = 25 * processedData.length / 2;
        const width = 648;
        // let width = 50 * processedData.length;
        // if(processedData.length > 30){
        //     width = 25 * processedData.length / 2;
        // }
        const margin = { top: 20, right: 20, bottom: 90, left: 50 }
        let svgWidth;

        if (window.innerWidth > 980) {
            // laptop
            svgWidth = 768;
        } else if (window.innerWidth > 540) {
            // tablet
            svgWidth = window.innerWidth * 0.7;
        } else {
            // hp
            svgWidth = window.innerWidth * 0.8;
        }

        // setSlice(Math.floor(width / svgWidth) + 1);
        setSlice(Math.floor(processedData2.length / maxTitik) + 1); // layar lebar svg
        console.log({ width, svgWidth })

        // Buat SVG di dalam div yang menggunakan useRef
        const svg = d3.select(chartRef.current)
            .append('svg')
            // .attr('class', classTailwindCSS)
            .attr('height', height)
            .attr('width', width)
            // .style('background', '#2C2C2C')
            .attr('class', 'svgOne bgg-bl min-w-lg')

        const x = d3.scaleBand()
            .domain(processedData.map(d => d.date)) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
            .range([margin.left, width - margin.right]);
        // const x = d3.scaleLinear()
        //     .domain([d3.min(sampledData, d => d['create_at']), d3.max(sampledData, d => d.create_at)]) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
        //     .range([margin.left, width - margin.right]);
        // const x = d3.scaleLinear()
        //     .domain([d3.min(data, d => d['create_at']), d3.max(data, d => d.create_at)]) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
        //     .range([margin.left, width - margin.right]);
        // const x = d3.scaleTime()
        //   .domain(d3.extent(data, d => d.datetime)) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
        //   .range([margin.left, width - margin.right]);


        const y = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => Math.max(d.HR, d.RR)) + 50]) // membentuk garis dari 0 hingga data value paling tinggi (max)
            .range([height - margin.bottom, margin.top]);
        // Pada sumbu Y, kita biasanya ingin nilai 0 berada di bawah (koordinat terbesar), 
        // dan nilai terbesar berada di atas (koordinat terkecil). Oleh karena itu, range Y 
        // dibalik, dari [height, 0]. Jadi, 0 akan dipetakan ke bagian bawah grafik 
        // (misalnya height = 400), dan 90 akan dipetakan ke bagian atas (0).

        // const line = d3.line()
        //     .x(d => x(d.date))
        //     .y(d => y(d[["avg"]]));
        const lineRR = d3.line()
            .x(d => x(d.date))
            .y(d => y(d[["RR"]]));
        const lineHR = d3.line()
            .x(d => x(d.date))
            .y(d => y(d[["HR"]]));

        // console.log({ line })

        // gambar line
        // const linepath = svg.append('path')
        //     .datum(processedData)
        //     .attr('fill', 'none')
        //     .attr('stroke', 'rgba(75, 192, 192, 1)')
        //     .attr('stroke-width', 2)
        //     .attr('d', line);



        const linepathHR = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(75, 192, 192, 1)')
            .attr('stroke-width', 2)
            .attr('d', lineHR);

        const linepathRR = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(75, 192, 192, 1)')
            .attr('stroke-width', 2)
            .attr('d', lineRR);


        // Deteksi perubahan tanggal
        let previousDate = null;
        let firstInSlice = true;

        processedData.forEach((d, i) => {
            const currentDate = d.date.toDateString();
            if (previousDate !== currentDate || firstInSlice) {
                // Gambar garis putus-putus di sini
                let linePosition = x(d.date); // Posisi X berdasarkan tanggal
                if (!firstInSlice && previousDate === currentDate) {
                    // Jika tanggal sama dengan slide sebelumnya, buat garis di posisi paling kiri
                    linePosition = margin.left;
                }

                svg.append('line')
                    .attr('x1', linePosition) // Posisi X berdasarkan tanggal atau pojok kiri
                    .attr('y1', margin.top)
                    .attr('x2', linePosition) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', linePosition + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', 'white')
                    .attr('font-size', 10)
                    .text(currentDate);

                firstInSlice = false; // setelah pertama kali di slide
            }

            previousDate = currentDate;
        });


        // memberikan titik pada ujung sumbu y
        const circlesHR = svg.selectAll('circle.hr-circle')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.date))
            .attr('cy', d => y(d["HR"]))
            .attr('r', 4)
            .attr('fill', 'rgba(0, 90, 143, 1)') // Menggunakan modulo untuk memastikan warna selalu tersedia
            .on('mouseover', (event, d) => {
                const [xPos, yPos] = d3.pointer(event); // mouse x, y
                // const scrollX = svg.node().parentElement.scrollLeft; // Ambil scroll horizontal dari container
                // const scrollY = svg.node().parentElement.scrollTop; // Ambil scroll vertical dari container
                // console.log({ xPos, yPos, scrollX })
                let x = xPos;
                if (scroolState[label] > 1) {
                    // x = xPos - (768 * (scroolState[label] - 1));
                    // console.log(x, xPos, (768 * (scroolState[label] - 1)))
                }
                // console.log({ scroolLevel, scroolState[label] }, (xPos - (scroolState[label] * 768) + 10), xPos, { x });
                tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(`<p>Date: ${String(d.date).split('GMT')[0]} </p> <p>Aktivitas Pasien : ${d.activity == undefined ? 'Tidak ada riwayat' : d.activity} </p> <p> InterQuartile HR: ${d["HR"]} </p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });

        const circlesRR = svg.selectAll('circle.rr-circle')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.date))
            .attr('cy', d => y(d["RR"]))
            .attr('r', 4)
            .attr('fill', 'rgba(7, 172, 123, 1)') // Menggunakan modulo untuk memastikan warna selalu tersedia
            .on('mouseover', (event, d) => {
                const [xPos, yPos] = d3.pointer(event); // mouse x, y
                // const scrollX = svg.node().parentElement.scrollLeft; // Ambil scroll horizontal dari container
                // const scrollY = svg.node().parentElement.scrollTop; // Ambil scroll vertical dari container
                // console.log({ xPos, yPos, scrollX })
                let x = xPos;
                if (scroolState[label] > 1) {
                    // x = xPos - (768 * (scroolState[label] - 1));
                    // console.log(x, xPos, (768 * (scroolState[label] - 1)), d)
                }
                // console.log({ scroolLevel, scroolState[label] }, (xPos - (scroolState[label] * 768) + 10), xPos, { x });
                tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(`<p>Date: ${String(d.date).split('GMT')[0]} </p> <p>Aktivitas Pasien : ${d.activity == undefined ? 'Tidak ada riwayat' : d.activity} </p> <p> InterQuartile RR: ${d["RR"]} </p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });


        // Buat format tanggal dan waktu dengan d3.timeFormat
        const formatDateTime = d3.timeFormat("%H:%M:%S");

        svg.append('g') // g = group
            .attr('transform', `translate(-15,${height - margin.bottom})`) // translate x, y
            .call(d3.axisBottom(x)
                .tickFormat(formatDateTime)
                .ticks(XCount) // memberikan jumlah titk yang dapat dicetak pada sumbu x
                .tickPadding(8)) // jarak antar titik dengan label
            // .tickFormat(d3.timeFormat("%H:%M:%S")) // Format lengkap dengan jam, menit, dan detik
            // .ticks(5) // Tentukan jumlah ticks, bisa diubah sesuai kebutuhan // ?
            .selectAll('text') // Memilih semua elemen teks (label) pada sumbu
            .attr('transform', 'rotate(-45)') // Memutar label 45 derajat
            .style('text-anchor', 'end') // Menyelaraskan teks ke ujung
            .style('font-size', 8)
            .style('padding-right', 2)

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

            x.call(d3.axisBottom(newX).ticks(XCount).tickPadding(8));
            y.call(d3.axisLeft(newY).ticks(15));

            // linepath.attr('d', d3.line()
            //     .x(d => newX(d.date))
            //     .y(d => newY(d[["avg"]]))
            // );
            linepathHR.attr('d', d3.line()
                .x(d => newX(d.date))
                .y(d => newY(d[["HR"]]))
            );

            linepathRR.attr('d', d3.line()
                .x(d => newX(d.date))
                .y(d => newY(d[["RR"]]))
            );

            // circles
            //     .attr('cx', d => newX(d.date))
            //     .attr('cy', d => newY(d["avg"]));
            circlesHR
                .attr('cx', d => newX(d.date))
                .attr('cy', d => newY(d["HR"]));
            circlesRR
                .attr('cx', d => newX(d.date))
                .attr('cy', d => newY(d["RR"]));
        };

        // Tambahkan event zoom pada SVG
        svg.call(d3.zoom()
            .scaleExtent([1, 200])  // Atur batas zoom in dan zoom out
            .translateExtent([[0, 0], [width, height]])  // Batas area yang bisa di-pan
            .on('zoom', zoomed));  // Panggil fungsi zoomed saat zoom/pan terjadi
    }

    // Fungsi untuk memproses data dan menghilangkan duplikat
    const processData = (rawData) => {
        console.log({ rawData }, 306)
        // Urutkan data berdasarkan create_at
        const sortedData = rawData.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Gunakan Set untuk menyimpan nilai unik
        const uniqueValues = new Set();

        // Filter data untuk menghilangkan duplikat
        return sortedData.filter(item => {
            const value = item["RR"];
            if (!uniqueValues.has(value)) {
                uniqueValues.add(value);
                return true;
            }
            return false;
        });
    }

    // const y = d3.scaleTime()
    // .domain()

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
            <div data-aos="fade-up" className="me-auto mb-3 flex md:flex-row flex-col md:items-center md:gap-0 gap-2 sm:justify-start justify-between">
                {slice > 1 ? (
                    <div className='md:flex-col lg:flex-row flex-row flex'>
                        {scroolState[label] > 1 ? (
                            <button className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                                <FaAngleLeft color='white' size={16} />

                            </button>
                        ) : null}
                        {scroolState[label] < slice ? (
                            <button className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('plus')}>
                                <FaAngleRight color='white' size={16} /> 
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex sm:flex-row overflow-x-auto">
                    <button id={`zoom_panel_${label}`} className='whitespace-nowrap rounded-md bg-slate-800 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='whitespace-nowrap rounded-md bg-slate-800 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        Graphic {label}
                    </button>
                    <button id='' className='whitespace-nowrap rounded-md bg-slate-800 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        HR Point
                    </button>
                    <button id='' className='whitespace-nowrap rounded-md bg-slate-800 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        RR Point
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

export default InterquartileGraph;