import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1
};

function LineGraph({ data, label, keyValue, color }) {
    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef();
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);
    const XCount = 10;

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
            simulateScroll(768 * (scroolState[label] - 1))
        } else if (opt == 'decrement' && scroolState[label] > 1) {
            setSlider(slider - 1);
            scroolState[label]--;
            simulateScroll((768 * (scroolState[label] - 1)));
        }
    }

    // useEffect(() => {
    //   // init for using label x date
    //   const parseDate = d3.timeParse('%d-%m-%Y %H:%M:%S'); // function untuk merubah string to date
    data.forEach(d => {
        // const mergeDateTime = `${d.date} ${d.time}`;
        d.create_at = new Date(d.create_at); // merubah isi dari array
    });

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    const drawChart = (rawData) => {
        // Proses data untuk menghilangkan duplikat
        const processedData = processData(rawData);

        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        // console.log({ label, data, tooltip })

        // reset gambar svg 
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove()

        // Tentukan ukuran chart
        const height = 500;
        const width = 25 * processedData.length / 2;
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

        setSlice(Math.floor(width / svgWidth) + 1); // layar lebar svg
        console.log({ width, svgWidth })

        // Buat SVG di dalam div yang menggunakan useRef
        const svg = d3.select(chartRef.current)
            .append('svg')
            // .attr('class', classTailwindCSS)
            .attr('height', height)
            .attr('width', width)
            // .style('background', '#2C2C2C')
            .attr('class', 'svgOne bgg-bl')

        const x = d3.scaleBand()
            .domain(processedData.map(d => d.create_at)) // memecah data tanggal dan memetakan dari terawal hingga ke akhir (A-Z) ASC
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
            .domain([0, d3.max(processedData, d => d[keyValue]) + 10]) // membentuk garis dari 0 hingga data value paling tinggi (max)
            .range([height - margin.bottom, margin.top]);
        // Pada sumbu Y, kita biasanya ingin nilai 0 berada di bawah (koordinat terbesar), 
        // dan nilai terbesar berada di atas (koordinat terkecil). Oleh karena itu, range Y 
        // dibalik, dari [height, 0]. Jadi, 0 akan dipetakan ke bagian bawah grafik 
        // (misalnya height = 400), dan 90 akan dipetakan ke bagian atas (0).

        const line = d3.line()
            .x(d => x(d.create_at))
            .y(d => y(d[[keyValue]]));

        // console.log({ line })

        // gambar line
        const linepath = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(75, 192, 192, 1)')
            .attr('stroke-width', 2)
            .attr('d', line);

        // memberikan titik pada ujung sumbu y
        const circles = svg.selectAll('circle')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.create_at))
            .attr('cy', d => y(d[keyValue]))
            .attr('r', 4)
            .attr('fill', (d, i) => color[i % color.length]) // Menggunakan modulo untuk memastikan warna selalu tersedia
            .on('mouseover', (event, d) => {
                const [xPos, yPos] = d3.pointer(event); // mouse x, y
                // const scrollX = svg.node().parentElement.scrollLeft; // Ambil scroll horizontal dari container
                // const scrollY = svg.node().parentElement.scrollTop; // Ambil scroll vertical dari container
                // console.log({ xPos, yPos, scrollX })
                let x = xPos + 10;
                if (scroolState[label] > 1) {
                    x = xPos - (768 * (scroolState[label] - 1));
                    console.log(x, xPos, (768 * (scroolState[label] - 1)))
                }
                // console.log({ scroolLevel, scroolState[label] }, (xPos - (scroolState[label] * 768) + 10), xPos, { x });
                tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(`<p>Date: ${String(d.create_at).split('GMT')[0]} </p> <p>Aktivitas Pasien : ${d.activity == undefined ? 'Tidak ada riwayat' : d.activity} </p> <p> ${keyValue}: ${d[keyValue]} </p>`);
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

            linepath.attr('d', d3.line()
                .x(d => newX(d.create_at))
                .y(d => newY(d[[keyValue]]))
            );

            circles
                .attr('cx', d => newX(d.create_at))
                .attr('cy', d => newY(d[keyValue]));
        };

        // Tambahkan event zoom pada SVG
        svg.call(d3.zoom()
            .scaleExtent([1, 200])  // Atur batas zoom in dan zoom out
            .translateExtent([[0, 0], [width, height]])  // Batas area yang bisa di-pan
            .on('zoom', zoomed));  // Panggil fungsi zoomed saat zoom/pan terjadi
    }

    // Fungsi untuk memproses data dan menghilangkan duplikat
    const processData = (rawData) => {
        // Urutkan data berdasarkan create_at
        const sortedData = rawData.sort((a, b) => new Date(a.create_at) - new Date(b.create_at));
        
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

    // const y = d3.scaleTime()
    // .domain()

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right"  style={styleTooltype} id={`tooltip${label}`}></div>
            <div data-aos="fade-up" className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        <button className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                            <FaAngleLeft color='white' size={16} />

                        </button>
                        <button className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('plus')}>
                            <FaAngleRight color='white' size={16} />
                        </button>
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    <button id={`zoom_panel_${label}`} className='rounded-md bg-slate-800 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md bg-blue-500 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        Graphic {label}
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