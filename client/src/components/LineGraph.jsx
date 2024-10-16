import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1,

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
        const processedData2 = processData(rawData);
        const processedData = processedData2.filter(d => d.RR !== null && d.HR !== null);


        // filtering warna circle
        color = processedData.map(item => {
            if (item.activity === 'Berjalan') return 'rgba(249, 39, 39, 0.8)'; // Merah untuk berjalan 
            if (item.activity === 'Tidur') return 'rgba(63, 234, 53, 0.8)'; // Hijau untuk tidur
            if (item.activity === 'Berolahraga') return 'rgba(116, 12, 224, 0.8)'; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 'rgba(7, 172, 123, 1)'; // Warna default
        });

        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove()
    
        const height = 500;
        const width = 25 * processedData.length / 2;
        const margin = { top: 20, right: 20, bottom: 90, left: 50 };
        let svgWidth;
    
        if (window.innerWidth > 980) {
            svgWidth = 768;
        } else if (window.innerWidth > 540) {
            svgWidth = window.innerWidth * 0.7;
        } else {
            svgWidth = window.innerWidth * 0.8;
        }
    
        setSlice(Math.floor(width / svgWidth) + 1);
    
        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bgg-bl min-w-lg')
    
        const x = d3.scaleBand()
            .domain(processedData.map(d => d.create_at))
            .range([margin.left, width - margin.right]);
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => d[keyValue]) + 10])
            .range([height - margin.bottom, margin.top]);
    
        const line = d3.line()
            .x(d => x(d.create_at))
            .y(d => y(d[[keyValue]]));
    
        svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(75, 192, 192, 1)')
            .attr('stroke-width', 2)
            .attr('d', line);
    
        // Deteksi perubahan tanggal
        let previousDate = null;
        
        processedData.forEach((d, i) => {
            console.log({d}, 'Linegraph');
            const currentDate = d.create_at.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.create_at)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.create_at)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus
    
                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.create_at) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', 'white')
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
            .attr('r', 4)
            .attr('fill', (d, i) => color[i % color.length])
            .on('mouseover', (event, d) => {
                const [xPos, yPos] = d3.pointer(event);
                let x = xPos + 10;
                if (scroolState[label] > 1) {
                    x = xPos - (768 * (scroolState[label] - 1));
                }
                tooltip.style('left', `${x}px`)
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(`<p>Date: ${String(d.create_at).split('GMT')[0]}</p> 
                            <p>Aktivitas Pasien: ${d.activity === undefined ? 'Tidak ada riwayat' : d.activity}</p>
                            <p>${keyValue}: ${d[keyValue]}</p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });
    
        // Sumbu X dengan format jam menit detik saja
        const formatTime = d3.timeFormat("%H:%M:%S");
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickFormat(formatTime)
                .ticks(XCount)
                .tickPadding(8))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', 8);
    
        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(y)
                .ticks(15));
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
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
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